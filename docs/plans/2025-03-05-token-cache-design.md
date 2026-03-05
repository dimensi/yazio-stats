# Кэширование токена YAZIO — дизайн

**Дата:** 2025-03-05

## Цель

Использовать сохранённый токен из файла в cwd, чтобы не логиниться по паролю при каждом запуске. При обновлении токена — перезаписывать файл. Флаг `--no-cache-token` отключает чтение и запись файла.

## Поведение

- **По умолчанию:** при первом запуске — логин по `credentials`, сохранение токена в `yazio-token.json` в cwd; при следующих запусках — подстановка токена в `Yazio`; при refresh — перезапись файла.
- **С `--no-cache-token`:** файл не читается и не пишется, используется только `credentials` (как сейчас).

## Файл токена

- **Путь:** `path.join(process.cwd(), 'yazio-token.json')`.
- **Формат:** один JSON-объект — то, что библиотека отдаёт в `onRefresh` (как в примере с `kv.set(..., JSON.stringify(token))`), без обёртки.
- **Запись:** атомарная — пишем во временный файл в той же директории (например `yazio-token.json.XXXXXX`), затем `fs.rename` на `yazio-token.json`.

## Флаг и передача в клиент

- Глобальная опция: `program.option('--no-cache-token', 'do not use or save token file')`.
- В каждой команде action получает `(opts, command)`. Глобальные опции: `command.parent?.opts() ?? {}`, передаём в `getClient(command.parent?.opts() ?? {})`.
- Сигнатура: `getClient(options?: { noCacheToken?: boolean }): Yazio`. При `options?.noCacheToken === true` — не читаем/не пишем файл, создаём `Yazio` только с `credentials`.

## Изменения в client.ts

- Если кэш не отключён: при наличии файла передаём в `Yazio` `token: readTokenFile()` (async, возвращает Promise); иначе не передаём `token`.
- Всегда при включённом кэше передаём `onRefresh: ({ token }) => writeTokenFile(token)`.
- Вынести работу с файлом в хелперы: `getTokenFilePath()`, `readTokenFile()`, `writeTokenFile(token)` (в client.ts или отдельный token-file.ts).

## Ошибки

- Файл есть, но битый JSON: не использовать кэш в этом запуске, залогировать короткое предупреждение, при успешном логине перезаписать файл через `onRefresh`.
- Нет прав на запись при `onRefresh`: залогировать ошибку, не падать.
- Файл не найден или кэш отключён: не передаём `token`, только `credentials`.
