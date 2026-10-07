import { plural } from '../utils/plural.js';

export const uk = {
  scan: {
    unknown: 'Це не картка Зоряного класу',
    noCamera: 'Немає доступу до камери. Дозволь камеру в налаштуваннях браузера або вибери учня зі списку'
  },
  order: {
    expired: 'Замовлення не на сьогодні'
  },
  credit: {
    done: n => `Зараховано +${n} ✦`,
    repeat: g => `Щойно вже зараховували ${g}. Підтвердити ще раз?`
  },
  redeem: {
    done: (item, n) => `Видано ${item} −${n} ✦`,
    insufficient: n => `Ще ${n} ✦`,
    cooldown: days => `Знову через ${days} дн.`,
    stock: 'Закінчилось'
  },
  offline: {
    teacher: "Немає зв'язку, спробуйте ще раз"
  },
  undo: 'Скасувати',
  receipt: {
    credit: n => `+${n} ✦`,
    redeem: (item, n, left) => `Отримано ${item} −${n} ✦, залишок ${left} ✦`
  },
  year: {
    countdown: (days, n) => `До кінця року ${days} ${plural(days, ['день','дні','днів'])}. Залишок ${n} ✦: встигни обміняти`
  }
};
