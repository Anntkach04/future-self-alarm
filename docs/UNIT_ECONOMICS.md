# Future Self Alarm — unit economics (max load)

Estimates Oct 2026. **Paying users only** (після 7-day trial).  
Ціна **$5.99/mo** · Apple **15%** (Small Business) → **~$5.09 net / user**.

Один сценарій — **максимальне** споживання (не light/mid).

---

## Максимум на 1 юзера / місяць

| Що | Макс | Як пораховано |
|----|------|----------------|
| **EL voice slot** | **1** | Поки клон живе в акаунті |
| **EL TTS** | **~32 генерації** | 1 preview + 1 create/save + **evening regen щодня** (~30) |
| **EL credits** | **~18 000** | ~550 символів на wake (≤28с) × 32; multilingual ≈ 1 credit / char |
| **OpenAI** | **~$0.05** | Зараз скрипт **фіксований**; mood advice щодня на gpt-4o-mini. Якщо увімкнути `USE_AI_ALARM_SCRIPTS` — до **~$0.20–0.40** |
| **Railway** | shared | Див. нижче — не per-user на старті |

**Жорсткий ліміт = slots.** Credits — included + overage/PAYG; слоти — лише апгрейд плану / Enterprise.

---

## План EL vs скільки юзерів тягне (при ~18k credits / user)

| План | $/mo | Slots | Credits/mo | Макс юзерів по **slots** | Макс юзерів по **credits*** |
|------|-----:|------:|-----------:|-------------------------:|----------------------------:|
| Creator | 22 | 30 | 121k | **30** | **~6** |
| Pro | 99 | 160 | 600k | **160** | **~33** |
| Scale | 299 | 660 | 1.8M | **660** | **~100** |
| Business | 990 | 2 200 | 6M | **2 200** | **~330** |
| Enterprise | custom | custom | custom / PAYG | домовленість | домовленість |

\*Без докупки credits. У максимумі **credits закінчуються раніше за slots**.

---

## Overage rates (EL, per 1 000 credits)

Типові published rates для usage-based / legacy UBB (multilingual ≈ 1 credit = 1 char).  
Нові self-serve підписки можуть йти через **Pay As You Go** packs — порядок той самий; фінальну ставку дивись у EL Subscription.

| План | $/1k credits overage |
|------|---------------------:|
| Creator | **$0.30** |
| Pro | **$0.24** |
| Scale | **$0.18** |
| Business | **$0.12** |

Формула: `overage $ = max(0, users×18k − included) / 1000 × rate`.

---

## P&L при максимальному TTS (цифри)

Net = users × $5.09.  
EL план = мінімальний, де **вистачає slots**; якщо credits дешевше на вищому плані без overage — беремо його.  
OpenAI ≈ $0.05/user · Railway ≈ $5 → $20 → $50 → $100 → $200.

| Paying | EL план | EL sub $ | Credits need | Included | Overage $ | Net $ | OpenAI+RW $ | **Profit $** |
|-------:|---------|---------:|-------------:|---------:|----------:|------:|------------:|-------------:|
| 10 | Creator | 22 | 180k | 121k | **18** | 51 | 6 | **+5** |
| 30 | Pro | 99 | 540k | 600k | **0** | 153 | 7 | **+47** |
| 50 | Pro | 99 | 900k | 600k | **72** | 255 | 8 | **+76** |
| 100 | Scale | 299 | 1.8M | 1.8M | **0** | 509 | 10 | **+200** |
| 160 | Scale | 299 | 2.88M | 1.8M | **194** | 814 | 13 | **+308** |
| 300 | Scale | 299 | 5.4M | 1.8M | **648** | 1 527 | 20 | **+560** |
| 660 | Business | 990 | 11.9M | 6M | **706** | 3 359 | 40 | **+1 623** |
| 1 000 | Business | 990 | 18M | 6M | **1 440** | 5 090 | 60 | **+2 600** |
| 2 000 | Business | 990 | 36M | 6M | **3 600** | 10 180 | 100 | **+5 490** |
| 5 000 | Enterprise | ~2 000* | 90M | deal | ~7 200† | 25 450 | 200 | **~+16 050** |
| 10 000 | Enterprise | ~4 000* | 180M | deal | ~14 400† | 50 900 | 400 | **~+32 100** |

\*Enterprise list — **орієнтир** (не публічний прайс); заміни на цифру з sales quote.  
†Overage для 5k/10k пораховано як **$0.08 / 1k** на весь volume (типовий enterprise discount vs Business $0.12). Без deal: при $0.12/1k на 5k → EL credits alone ≈ **$10 800**, profit ≈ **+$12 450** мінус enterprise fee.

### Як зійшлися ключові рядки

- **10:** shortfall 59k × $0.30/1k = **$18** → 51 − 22 − 18 − 6 = **+$5**
- **50:** shortfall 300k × $0.24 = **$72** → 255 − 99 − 72 − 8 = **+$76**
- **100:** Pro+PAYG було б 1.2M × $0.24 = **$288** → profit ~+$112; **Scale $299 без overage** → **+$200** (краще)
- **300:** shortfall 3.6M × $0.18 = **$648** → 1527 − 299 − 648 − 20 = **+$560**
- **1 000:** shortfall 12M × $0.12 = **$1 440** → 5090 − 990 − 1440 − 60 = **+$2 600**

### Спрощений висновок

- На максі (щоденний regen) маржа **залишається плюсовою** навіть з overage, якщо брати правильний план по slots.  
- **100 юзерів:** не сиди на Pro+PAYG — стрибай на **Scale** (+$200 vs ~+$112).  
- Головний важіль: рідший evening regen → credits ↓ → overage ↓ майже лінійно.  
- 2k+ слотів Business вистачає до ~2 200; далі **Enterprise** обов’язково по slots, не лише по credits.

---

## Railway

| Юзери | Що робити |
|------:|-----------|
| до ~300–500 | Поточний / Hobby (~$5) зазвичай ок |
| сотні–тисячі DAU | Pro / більше RAM, дивись latency |
| 5k+ | Окремий capacity plan |

Upgrade **не** прив’язаний до 30 EL-слотів.

---

## Custom EL (більше слотів, менше $)?

Писати **Contact sales / Enterprise** можна.  
Реалістично: більше slots+credits за **commit**, не Creator-ціна з тисячами слотів.  
На sales несуть: N concurrent IVC slots + M chars TTS/mo (у максі M ≈ users × 18 000).

---

## Практична драбина

1. Creator — тести, прибрати сміття в My Voices.  
2. ~25–30 клонів → **Pro**.  
3. ~100 paying + щоденний regen → **Scale** (не Pro+великий overage).  
4. ~330+ по credits або ~660+ по slots → **Business**.  
5. 2 200+ клонів → **Enterprise** з цифрами з таблиці вище.
