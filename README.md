# logsystem

## logsystem.tar 디렉토리 목록
```
logsystem : 로그 적재 및 조회 서버
 └ src : 과제 구현 코드
minio : 오브젝트 스토리지
 └ data
mongo : 로그 저장용 NoSQL DB
 └ db
redis : 로그 임시 저장용 캐쉬
 └ data
docker-compose.yaml
move_logs_glacier.sh
ngrok.yaml
```

## 빌드 및 실행 방법
- 레포지토리 내 **logsystem.tar** 파일을 다운로드 받아 압축을 풉니다.
- `logsystem`으로 이동합니다.
- ngrok 환경 변수 및 `ngrok.yaml`의 domain 값을 본인에 맞게 입력합니다.
- `logserver`로 이동 후, `docker build -t logserver:latest`로 적재/조회서버 이미지를 빌드합니다.
- 다시 logsystem으로 돌아과, `docker compose up -d --build` 로 시스템 컨테이너들을 생성합니다.
- `ngrok.yaml`에서 입력한 domain 값으로 API를 실행합니다.
- `move_logs_glacier.sh` 스크립트로 mongoDB 데이터를 minio(오브젝트 스토리지)로 옮길 수 있습니다.
  - `DAYS_AGO_MS=$(($(date -d "5 minutes ago" +"%s") * 1000 + 62135596800000))` 의 "5 minutes ago" 부분을 알맞게 수정해 주세요

### 필요 환경 변수
- `NGROK_AUTH`: 본인의 NGROK 토큰

### API 엔드포인트
- (GET) /api/v1/stats/mobhunt : 몬스터 사냥 로그 집계
  - 파라메터: mobNm (/mobhunt?mobNm=...)
- (GET) /api/v1/stats/itemgain : 플레이어 아이템 습득 로그 집계
  - 파라메터: userId (/itemgain?userId=...)

## 테스트 월드
- 메이플월드 테스트베드를 구축해 직접 플레이하면서 로그를 전송할 수 있습니다.
- `#fC0CcC` 이 코드로 친구 요청 보내주시면 월드에 초대해 드리겠습니다.
