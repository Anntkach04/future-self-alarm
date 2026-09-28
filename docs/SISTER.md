# Future Self Alarm — для сестри

**Лінк на цю інструкцію:** https://github.com/Anntkach04/future-self-alarm/blob/main/docs/SISTER.md

Апка ставиться на **твій iPhone з твого Mac**. $99 Apple Developer не потрібні.

---

## Що Анна тобі надсилає

| Що | Як |
|----|----|
| Ця інструкція | лінк GitHub вище |
| Код апки | репозиторій GitHub (не zip з чату) |
| Файл **`.env`** | **особисте повідомлення** (Telegram / iMessage) — там ключі API. Не викладати в GitHub |

Більше файлів руками кидати не треба. Cursor Agent поставить залежності сам.

---

## Якщо ти вже підключала раніше

У тебе вже можуть бути: Cursor, Xcode, папка проєкту, старий `.env`.

Тоді:

1. Відкрий Cursor → папку проєкту (`~/future-self-alarm` або як назвала).
2. **New Agent chat** і встав:

```text
Онови Future Self Alarm на моєму Mac і iPhone.

1. У проєкті зроби git pull origin main (якщо є конфлікти — скажи мені).
2. npm install у корені і в server/; якщо треба — npm run beds:download у server/.
3. Перевір/онови .env: EXPO_PUBLIC_API_URL=http://ПОТОЧНИЙ_IP_MAC:8787 (не localhost). IP: ipconfig getifaddr en0.
4. Запусти npm run server і перевір /api/health.
5. Збери Release і постав на підключений iPhone.
6. Якщо шлях з пробілами ламає збірку — збирай з ~/fsa-clean, тримай той самий .env.

Питай мене лише коли треба Trust / Developer Mode / розблокувати телефон.
Не коміть і не пуш. Не друкуй API-ключі.
```

3. Якщо Анна надіслала новий `.env` — заміни старий у корені проєкту (або встав ключі агенту в чат).
4. Розблокуй iPhone на кабелі.

Готово — не треба клонувати з нуля.

---

## Якщо ставиш уперше

### Один раз руками

1. Mac + iPhone, **одна Wi‑Fi**, кабель USB.
2. App Store → **Xcode** → встановити → відкрити → Agree.
3. iPhone: Settings → Privacy & Security → **Developer Mode** → On.
4. **Cursor** → увійти в свій акаунт.
5. iPhone: Trust This Computer, якщо спитає.

### Код

У Терміналі:

```bash
cd ~
git clone https://github.com/Anntkach04/future-self-alarm.git
```

Cursor: **File → Open Folder** → `~/future-self-alarm`.

Якщо папка вже є:

```bash
cd ~/future-self-alarm
git pull origin main
```

### Файл `.env`

Анна надсилає готовий `.env` в особисті. Поклади його в корінь проєкту (поруч з `package.json`).

Або створи з прикладу і встав ключі від Анни:

```bash
cp .env.example .env
```

Обовʼязково:

```
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
VOICE_API_PORT=8787
EXPO_PUBLIC_API_URL=http://ТВІЙ_IP_MAC:8787
```

IP Mac: System Settings → Wi‑Fi → Details.  
**Не** `localhost` — телефон його не бачить.

### Команда для Agent (перший раз)

Cursor → **New Agent chat** → встав:

```text
Підключи Future Self Alarm на мій iPhone. Роби все сам через термінал, питай мене лише коли треба щось натиснути на телефоні.

1. Перевір Node, npm, Xcode, CocoaPods; якщо чогось немає — встанови.
2. npm install у корені; у server/: npm install і npm run beds:download якщо треба.
3. IP Mac (ipconfig getifaddr en0) → у .env EXPO_PUBLIC_API_URL=http://ЦЕЙ_IP:8787 (не localhost).
4. npm run server, перевір /api/health.
5. Release-збірка на підключений iPhone. Якщо locked — xcrun devicectl device install app.
6. Якщо шлях з пробілами ламає збірку — копіюй у ~/fsa-clean і збирай звідти.

Не коміть і не пуш. Не друкуй API-ключі.
```

Після install на iPhone: Settings → General → VPN & Device Management → Trust (якщо спитає).

---

## Щодня (коли тестуєш)

1. На Mac тримай сервер увімкненим:

```bash
cd ~/future-self-alarm
npm run server
```

2. Mac не має засинати під час тесту.
3. Mac і iPhone — одна Wi‑Fi.
4. Відкрий апку **Future Self Alarm**.

Якщо IP Mac змінився → агенту:  
«Онови EXPO_PUBLIC_API_URL на поточний IP і перезбери Release на iPhone.»

---

## Якщо щось не так

| Симптом | Що робити |
|---------|-----------|
| Cannot reach the voice server | `npm run server`; одна Wi‑Fi; Local Network ON для апки; IP у збірці = IP Mac |
| Апка одразу закривається | попроси агента перезібрати Release |
| Trust / code signature | Settings → General → VPN & Device Management → Trust |
| Стара версія | `git pull` + нова Release-збірка |

Safari на iPhone для перевірки сервера:  
`http://ТВІЙ_IP:8787/api/health` — має відкритись JSON.
