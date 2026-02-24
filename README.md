# yazio-stats

CLI-утилита для выгрузки статистики питания из [YAZIO](https://www.yazio.com/).

Позволяет получить данные о калориях, БЖУ, весе, воде, тренировках и целях за любой период — в виде таблицы, JSON или CSV.

## Установка

```bash
git clone git@github.com:dimensi/yazio-stats.git
cd yazio-stats
npm install
```

## Настройка

Скопируй `.env.example` в `.env` и укажи свои логин/пароль от YAZIO:

```bash
cp .env.example .env
```

```env
YAZIO_USERNAME=your-email@example.com
YAZIO_PASSWORD=your-password
```

## Использование

```bash
npx tsx src/cli.ts <команда> [опции]
```

### Команды

| Команда | Описание |
|---------|----------|
| `summary` | Дневные сводки: калории, БЖУ, вода, шаги |
| `meals` | Список съеденных продуктов по приёмам пищи |
| `water` | Потребление воды (мл/день) |
| `weight` | История взвешиваний |
| `exercises` | Тренировки |
| `goals` | Текущие цели по питанию |

### Опции

| Опция | Описание | По умолчанию |
|-------|----------|--------------|
| `--from <YYYY-MM-DD>` | Начало периода | 30 дней назад |
| `--to <YYYY-MM-DD>` | Конец периода | сегодня |
| `--format <format>` | Формат вывода: `table`, `json`, `csv` | `table` |

### Примеры

```bash
# Сводка за последние 30 дней
npx tsx src/cli.ts summary

# Питание за январь в JSON
npx tsx src/cli.ts summary --from 2025-01-01 --to 2025-01-31 --format json

# Продукты за неделю
npx tsx src/cli.ts meals --from 2025-02-17 --to 2025-02-23

# Экспорт веса в CSV
npx tsx src/cli.ts weight --format csv > weight.csv

# Текущие цели
npx tsx src/cli.ts goals
```

Также доступны npm-скрипты для быстрого запуска:

```bash
npm run summary
npm run meals
npm run water
npm run weight
npm run exercises
npm run goals
```

## Сборка бинарника

Можно собрать в один исполняемый файл через [Bun](https://bun.sh/) — работает без Node/Bun/tsx:

```bash
npm run build
# создаёт ./yazio-stats
```

Бинарник читает `.env` из текущей рабочей директории, поэтому запускать нужно из папки проекта, либо прокинуть переменные напрямую:

```bash
YAZIO_USERNAME=email YAZIO_PASSWORD=pass ./yazio-stats summary
```

### Кросс-компиляция

Bun умеет собирать под другие платформы прямо с текущей машины:

```bash
# macOS ARM (по умолчанию на Apple Silicon)
bun build --compile src/cli.ts --outfile yazio-stats

# macOS Intel
bun build --compile --target=bun-darwin-x64 src/cli.ts --outfile yazio-stats-mac-x64

# Linux x64
bun build --compile --target=bun-linux-x64 src/cli.ts --outfile yazio-stats-linux

# Linux ARM
bun build --compile --target=bun-linux-arm64 src/cli.ts --outfile yazio-stats-linux-arm

# Windows x64
bun build --compile --target=bun-windows-x64 src/cli.ts --outfile yazio-stats.exe
```

## Примечания

- API YAZIO неофициальный — может перестать работать при обновлении сервиса
- Каждый день = отдельный запрос к API, поэтому выгрузка за месяц занимает ~30 секунд
- Данные о шагах берутся из YAZIO (синхронизация с Apple Health / Google Fit)
