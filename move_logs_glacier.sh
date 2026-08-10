#!/bin/bash

DATE_STR=$(date +"%Y-%m-%d")
# 몽고DB의 timestamp는 0001-01-01 기준, date -d는 1970-01-01 기준으로 차이 계산(62135596800000 더하기)
DAYS_AGO_MS=$(($(date -d "5 minutes ago" +"%s") * 1000 + 62135596800000)) # 현재 기준 언제 이전까지의 데이터 이관할지

echo ${DAYS_AGO_MS}

EXPORT_DIR="/tmp/mongo_exports"
FILE_NAME="logs_${DATE_STR}.json"
GZ_FILE_NAME="${FILE_NAME}.gz"

HOME_DIR="/home/admin/logsystem"

MONGO_CONTAINER="logserver-mongo"       # Mongo 컨테이너 이동
DB_NAME="msw_logs"            # Mongo DB명
COLLECTION="base_logs"        # Mongo 콜렉션명

MINIO_ALIAS="minio" # mc alias로 설정한 명칭
BUCKET_NAME="msw-logs-glacier"

# 1. 이관 작업 시작
echo "[$(date)] MongoDB 데이타 이관 시작..."

# 임시 폴더 생성
mkdir -p ${EXPORT_DIR}
cd ${EXPORT_DIR}

# 2. 몽고에서 기준 이전 데이타 가져오기
echo "[$(date)] 오래된 데이타 추출 중..."
podman exec ${MONGO_CONTAINER} mongoexport \
  --db ${DB_NAME} \
  --collection ${COLLECTION} \
  --query "{\"timestamp\": {\"\$lt\": ${DAYS_AGO_MS}}}" \
  --out /data/db/${FILE_NAME}

# 추출한 데이타 임시폴더에 저장
podman cp ${MONGO_CONTAINER}:/data/db/${FILE_NAME} ${EXPORT_DIR}/${FILE_NAME}

# 3. 용량 절감을 위한 파일 압축
echo "[$(date)] 추출된 데이터 압축 중..."
gzip -f ${FILE_NAME}
echo ${FILE_NAME}

# 4. Minio로 업로드
echo "[$(date)] Minio 스토리지로 이관 중..."
$HOME_DIR/mc cp ${EXPORT_DIR}/${GZ_FILE_NAME} ${MINIO_ALIAS}/${BUCKET_NAME}/${DATE_STR:0:4}/${DATE_STR:5:2}/${GZ_FILE_NAME}

# 업로드 성공 확인
if [ $? -eq 0 ]; then
    echo "[$(date)] Minio 업로드 성공. MongoDB에 있는 이전 데이타들을 삭제합니다."

    # 4. MongoDB에서 오래된 데이터 삭제
    podman exec ${MONGO_CONTAINER} mongosh ${DB_NAME} --eval "db.${COLLECTION}.deleteMany({\"timestamp\": {\"\$lt\": ${DAYS_AGO_MS}}})"

    # 임시 파일 삭제
    rm -f ${EXPORT_DIR}/${GZ_FILE_NAME}
    podman exec ${MONGO_CONTAINER} rm -f /data/db/${FILE_NAME}

    echo "[$(date)] 데이타 이관 완료!"
else
    echo "[$(date)] 데이타 이관 실패! MongoDB에 있는 이전 데이타들을 삭제하지 않습니다..."
    exit 1
fi
