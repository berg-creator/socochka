// Общее для страницы и еженедельного напоминания (.github/remind.js)
const people = ['Миша', 'Паша', 'Максим', 'Карим']; // убирают
const members = [...people, 'Катя']; // все на сайте: Катя не убирает, но оценивает, голосует, пишет заявки
const bosses = ['Максим', 'Паша', 'Карим', 'Миша']; // староста по очереди, начиная с этой недели
const objects =[['🧽', 'Поверхности'], ['🚪', 'Коридор'], ['🚽', 'Туалет'], ['🛋️', 'Кухня + гостиная']];
const START = Date.UTC(2026, 9, 26); // понедельник, с которого действует график выше
const WEEK = 7 * 864e5;
// уведомления — приложение ntfy, канал TOPIC
// ponytail: канал открыт всем, кто знает название (оно в коде); свой сервер ntfy с паролем, если начнут спамить
const TOPIC = 'socochka-fcbd86';
const SITE = 'https://berg-creator.github.io/socochka/';
if (typeof module === 'object') module.exports = {people, bosses, objects, START, WEEK, TOPIC, SITE};
