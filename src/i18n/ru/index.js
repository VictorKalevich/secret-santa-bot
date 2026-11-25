// Русский словарь (060): файл на область, ключи файла начинаются с области. Файлы app-* — словарь приложения (уходит
// в ответ me), остальные — тексты сервера. Новый файл области — строка здесь (у каждого языка тот же набор файлов).

import common from './common.js';
import api from './api.js';
import bot from './bot.js';
import botOwner from './bot-owner.js';
import chat from './chat.js';
import constraints from './constraints.js';
import cron from './cron.js';
import db from './db.js';
import eventParams from './event-params.js';
import events from './events.js';
import looks from './looks.js';
import membership from './membership.js';
import pairs from './pairs.js';
import panel from './panel.js';
import participant from './participant.js';
import roles from './roles.js';
import routes from './routes.js';
import setup from './setup.js';
import shipment from './shipment.js';
import stale from './stale.js';
import support from './support.js';
import vault from './vault.js';
import appBoot from './app-boot.js';
import appCore from './app-core.js';
import appHome from './app-home.js';
import appCompanies from './app-companies.js';
import appEvent from './app-event.js';
import appAdmin from './app-admin.js';
import appVault from './app-vault.js';
import appSheet from './app-sheet.js';

// [область, файл, тексты]
export const AREAS = [
  ['common', 'common.js', common],
  ['api', 'api.js', api],
  ['bot', 'bot.js', bot],
  ['botOwner', 'bot-owner.js', botOwner],
  ['chat', 'chat.js', chat],
  ['constraints', 'constraints.js', constraints],
  ['cron', 'cron.js', cron],
  ['db', 'db.js', db],
  ['eventParams', 'event-params.js', eventParams],
  ['events', 'events.js', events],
  ['looks', 'looks.js', looks],
  ['membership', 'membership.js', membership],
  ['pairs', 'pairs.js', pairs],
  ['panel', 'panel.js', panel],
  ['participant', 'participant.js', participant],
  ['roles', 'roles.js', roles],
  ['routes', 'routes.js', routes],
  ['setup', 'setup.js', setup],
  ['shipment', 'shipment.js', shipment],
  ['stale', 'stale.js', stale],
  ['support', 'support.js', support],
  ['vault', 'vault.js', vault],
  ['app.boot', 'app-boot.js', appBoot],
  ['app.core', 'app-core.js', appCore],
  ['app.home', 'app-home.js', appHome],
  ['app.companies', 'app-companies.js', appCompanies],
  ['app.event', 'app-event.js', appEvent],
  ['app.admin', 'app-admin.js', appAdmin],
  ['app.vault', 'app-vault.js', appVault],
  ['app.sheet', 'app-sheet.js', appSheet],
];

const merge = (app) => Object.assign({}, ...AREAS.filter(([area]) => area.startsWith('app.') === app).map(([, , texts]) => texts));

export default { server: merge(false), app: merge(true) };
