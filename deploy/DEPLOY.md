# Roomfit 서버 배포 (Ubuntu + PM2)

기존에 운영 중인 앱·웹은 건드리지 않고, `roomfit`이라는 PM2 프로세스를 하나 추가해 별도 포트(기본 3100)로 실행합니다.

## 1. 파일 올리기

내 컴퓨터 터미널에서 실행합니다. `사용자`, `서버IP`는 평소 SSH 접속할 때 쓰는 값으로 바꿉니다.

```bash
scp roomfit.zip 사용자@서버IP:~/
```

## 2. 서버에서 실행

```bash
ssh 사용자@서버IP
sudo apt install -y unzip     # unzip이 없을 때만
unzip roomfit.zip
cd roomfit
bash deploy/deploy.sh
```

스크립트가 Node 버전, 포트 충돌을 확인한 뒤 설치 → 빌드 → PM2 등록까지 진행하고 접속 주소를 출력합니다.

- 3100 포트를 이미 다른 서비스가 쓰고 있으면 멈추고 알려 줍니다. 그때는 다른 포트로 실행합니다.
  ```bash
  ROOMFIT_PORT=3200 bash deploy/deploy.sh
  ```
- 서버 재부팅 후에도 자동 실행되게 하려면 (이미 기존 서비스로 설정했다면 생략)
  ```bash
  pm2 startup   # 출력되는 sudo 명령을 그대로 한 번 실행
  ```

## 3. 주소 연결

### A. 바로 보기: `http://서버IP:3100`

방화벽에서 포트를 엽니다.

```bash
sudo ufw allow 3100/tcp
```

클라우드 서버(AWS, 네이버 클라우드, 가비아 등)는 콘솔의 보안 그룹·ACG에서도 3100 인바운드를 허용해야 합니다.

### B. 서브도메인으로 공개 (권장): `https://roomfit.내도메인`

1. 도메인 DNS에 A 레코드 추가: `roomfit` → 서버 IP
2. Nginx 설치 및 설정
   ```bash
   sudo apt install -y nginx
   sudo cp deploy/nginx-roomfit.conf /etc/nginx/sites-available/roomfit
   sudo nano /etc/nginx/sites-available/roomfit      # roomfit.example.com, 포트 수정
   sudo ln -s /etc/nginx/sites-available/roomfit /etc/nginx/sites-enabled/roomfit
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. HTTPS 인증서
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d roomfit.내도메인
   ```
4. Nginx로 연결한 뒤에는 앱이 외부에서 직접 보이지 않게 내부 주소로 다시 실행하고 포트를 닫습니다.
   ```bash
   ROOMFIT_HOST=127.0.0.1 bash deploy/deploy.sh
   sudo ufw delete allow 3100/tcp
   ```

주의: 기존 앱·웹이 80/443 포트를 Node로 직접 쓰고 있다면 Nginx가 시작되지 않습니다. 이 경우 `sudo ss -ltnp | grep -E ':80|:443'` 결과를 알려 주시면 기존 서비스까지 Nginx 뒤로 옮기는 설정을 만들어 드립니다.

## 회원·방 데이터

- 데이터 파일: 서버의 `~/roomfit-data/roomfit.db` (코드 폴더 밖이라 재배포해도 유지)
- 배포할 때마다 `~/roomfit-data/backup/`에 자동 백업, 최근 10개 보관
- 서버 Node가 22.13보다 낮으면 Roomfit 전용 Node를 `~/.roomfit-node`에 받아 씁니다. 서버 전체 Node는 바꾸지 않습니다.

## 업데이트할 때

새 zip을 올리고 압축을 덮어쓴 뒤 다시 실행합니다. 처음에 다른 포트나 호스트를 썼다면 같은 값을 다시 줍니다.

```bash
cd ~ && unzip -o roomfit.zip && cd roomfit && bash deploy/deploy.sh
```

## 자주 쓰는 명령

| 명령 | 용도 |
|---|---|
| `pm2 ls` | 실행 중인 서비스 목록 |
| `pm2 logs roomfit` | Roomfit 로그 |
| `pm2 restart roomfit` | 재시작 |
| `pm2 stop roomfit` | 중지 (다른 서비스는 그대로) |
