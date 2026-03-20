Начинаю эксперимент 176. Сначала прочитаю контекст проекта.
Отлично, вижу текущее состояние. Рассматриваю цели проекта. Последний exp175 делал cat animations (head tilt + body bounce). Цель "Cat companion" говорит "Осталось: больше анимаций". Посмотрю текущий cat.js и определю, какие анимации добавить.
Теперь у меня полная картина. Анализирую цели проекта и текущее состояние кота.

## Experiment 176: Cat breathing + sneeze animations

**Type:** Feature
**Goal:** Cat companion — больше анимаций
**Target:** ui/static/modules/cat.js
**Complexity Impact:** 0 файлов

**Что добавлю:**
1. **Дыхание (breathing)** — непрерывная осцилляция bodyOffY по синусоиде (±0.3px, ~3с период). Кот дышит — всегда активно в позе sitting. При sleeping — медленнее.
2. **Чихание (sneeze)** — редкое случайное событие (~раз в 2 минуты idle). Резкий jerk головы + "Апчхи!" + burst мелких частиц. Expression → surprised → neutral.

Реализую.
Теперь добавлю дыхание в render — осцилляция bodyOffY:
Теперь добавлю sneeze jerk к голове. Найду где head position вычисляется и добавлю sneeze offset:
Теперь добавлю логику sneeze в tick() — после body bounce блока:
Теперь добавлю `triggerSneeze()` функцию и speech для sneeze. Сначала добавлю speech строки:
Теперь добавлю `triggerSneeze()` функцию — перед PUBLIC API:
Теперь добавлю public API метод `triggerSneeze()`:
Проверю синтаксис:
Синтаксис OK. Теперь smoke-тесты:
Теперь закоммичу и обновлю цели:
Обновлю `.autoresearch.json` — цель Cat companion:
Обновлю last_experiment.md:
## Experiment Report

**Number:** 176
**Title:** Cat breathing + sneeze animations
**Type:** Feature
**Goal:** Cat companion — больше анимаций
**Target:** ui/static/modules/cat.js
**Complexity Impact:** 0 файлов
**Files Modified:** `ui/static/modules/cat.js`

### Results

**What was done:**
1. **Breathing** — непрерывная осцилляция bodyOffY по синусоиде (±0.3px, период ~3с в normal, ±0.4px и ~4.8с при sleep). Кот "дышит" — всегда активно в sitting pose, выключается при lying. Делает кота живым даже в idle.
2. **Sneeze** — редкое случайное событие (~0.1% за tick ≈ раз в 2 минуты idle). 3 фазы: pre-sneeze (голова тянутся назад) → jerk (голова резко вперёд) → recovery (микро-дрожь). Expression → surprised, 5 вариантов "Апчхи!" на русском, ear twitch, burst мелких частиц из области носа. Public API: `triggerSneeze()`.

**Working:** yes
**Tests:** syntax check + server import pass

### Decision

**Result:** KEEP
**Reason:** Две новые анимации делают кота живее. Breathing — subtle но постоянная жизнь, sneeze — забавный редкий event. Минимальный код, не ломает существующее.
**Next:** Продолжать добавлять анимации к коту (ear flick, tail twitch, kneading)

### Goals Updated

**Completed:** нет
**Modified:** Cat companion — добавлены breathing (exp176) и sneeze (exp176)
**Added:** нет

>>>EXPERIMENT_COMPLETE<<<