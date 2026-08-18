# Future Self Alarm — для сестри

Спочатку дивимось **веб-лінк (Vercel)** і узгоджуємо правки.  
Потім, коли дизайн ок — ставиш апку **на свій iPhone** з Mac. $99 Apple Developer **не потрібні**.

---

## Частина 1 — лише подивитись (Vercel)

Це сайт-прев’ю екранів у браузері. Можна відкрити з телефону або ноута.

**Що працює:** онбординг, чіпи, Home, як виглядає.

**Що не працює:** справжній диктофон, клон голосу, будильник на залоченому екрані. Це нормально для узгодження вигляду.

Після правок Анна оновлює Vercel — оновлюєш сторінку.

---

## Частина 2 — поставити на свій iPhone

Потрібно: **Mac**, **iPhone**, кабель, одна Wi‑Fi, ~30–60 хв першого разу.

### 1. Програми

1. App Store → **Xcode** → встановити → відкрити один раз → Agree.
2. У Терміналі:

```bash
xcode-select --install
```

3. Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
eval "$(/opt/homebrew/bin/brew shellenv)"
```

4. CocoaPods (Node уже стоїть — не чіпай):

```bash
brew install cocoapods
pod --version
node -v
npm -v
```

Якщо `node -v` або `npm -v` не працює в новому вікні — напиши Анні; Node є, просто треба підхопити PATH.

### 2. Код

```bash
git clone https://github.com/Anntkach04/future-self-alarm.git
cd future-self-alarm
npm install
cd server && npm install && npm run beds:download && cd ..
```

### 3. Ключі (файл `.env`)

Скопіюй приклад:

```bash
cp .env.example .env
```

Відкрий `.env` і встав значення, які надішле Анна в **особисте повідомлення** (не в GitHub):

```
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
VOICE_API_PORT=8787
EXPO_PUBLIC_API_URL=http://ТВІЙ_IP_MAC:8787
```

IP Mac: System Settings → Wi‑Fi → Details → IP address.  
Приклад: `EXPO_PUBLIC_API_URL=http://192.168.1.23:8787`

Mac і iPhone — **та сама Wi‑Fi**. Не `localhost` — телефон його не бачить.

### 4. Запуск (два вікна Терміналу)

**Вікно 1 — сервер** (тримати відкритим):

```bash
cd ~/future-self-alarm
npm run server
```

Перевірка в браузері Mac: http://localhost:8787/api/health  
Має бути JSON, не помилка.

Якщо `address already in use :::8787` — сервер уже запущений, не запускай другий.

**Вікно 2 — апка на телефон:**

Підключи iPhone кабелем, розблокуй, на iPhone: Settings → Privacy & Security → **Developer Mode** → On.

```bash
cd ~/future-self-alarm
npx expo run:ios --device
```

Перша збірка 5–15 хв. Вибери свій iPhone у списку, якщо спитає.

### 5. Дозволи в апці

| Коли | Що дозволити |
|------|----------------|
| Час будильника → Continue | Notifications |
| Запис голосу → мікрофон | Microphone + Speech Recognition |
| Зберегти alarm | Notifications, якщо ще ні |

### 6. Якщо щось не так

| Симптом | Що зробити |
|---------|------------|
| `command not found: npm` | `source ~/.zshrc`, перевірити `node -v` |
| CocoaPods / brew missing | кроки Homebrew + `brew install cocoapods` |
| Mood завжди однакова фраза | сервер не запущений або в `.env` стоїть `localhost`, а не IP Mac |
| Апка не чує слова на диктофоні | це не Expo Go; має бути `npx expo run:ios --device` |
| Trust This Computer | на iPhone натисни Trust |

---

## Що сказати Анні після установки

- Чи відкрився онбординг
- Чи підсвічуються слова, коли читаєш скрипт
- Чи зібрався будильник
- Скрін / відео, якщо щось зламалось
