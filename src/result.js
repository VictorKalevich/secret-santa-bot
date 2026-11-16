// Отказ модуля (029): { ok: false, error } — один помощник на все модули; status — код ответа API, если не 400.
// Успех модули возвращают сами: { ok: true, ...данные }. Отказ с добавочным признаком — { ...no(текст), признак }.
export const no = (error, status) => (status ? { ok: false, error, status } : { ok: false, error });
