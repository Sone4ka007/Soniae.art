# Предложение по очистке календаря

Этот файл ничего не применяет. `content/events.json` и решения в таблице не меняются.
Новый сбор больше не добавляет такие строки. Уже сохранённые строки со статусом approved или rejected остаются.

Как разобрать повторы, если Соня захочет: оставить одну строку (лучше ту, что уже approved), остальным поставить rejected и `review_reason=duplicate_record`. Не удалять строки пачкой.

## Повторы одного события: 23 групп

Лишних строк в этих группах: 24.

Отдельно одна и та же ссылка в один и тот же день записана несколько раз: 20 ссылок, 22 лишних строк. Новый сбор такую строку не создаёт. Серии с разными датами по одной ссылке сюда не входят.

- 2026-09-03 · Экскурсия по выставке «Хлеб» · Центр Зотов
  оставить `moscow-2026-09-22-6e9b4343b7` (rejected)
  повторяет `moscow-2026-09-23-6e9b4343b7` (rejected) https://centrezotov.ru/events/hleb/ekskursiya-po-vystavke-hleb/
- 2026-09-23 · О событии · Государственный Эрмитаж
  оставить `spb-2026-09-23-4e1f443b8c` (rejected)
  повторяет `spb-2026-09-24-4e1f443b8c` (rejected) https://hermitagemuseum.org/what-s-on/afisha_mincult/?lng=ru
- 2026-09-24 · События и выставки · РОСФОТО
  оставить `spb-2026-09-24-3497c8964e` (rejected)
  повторяет `spb-2026-09-29-3497c8964e` (rejected) https://rosphoto.org/posetitelyam/events/7/
- 2026-09-25 · Прием заявок на участие в онлайн-лаборатории программы «Новые медиа» Музея «Гараж» 2026 года · Музей «Гараж»
  оставить `moscow-2026-09-25-544123cac3` (approved)
  повторяет `moscow-2026-09-25-fa0dd49ab0` (rejected) https://garagemca.org/event/5df89fae-0b13-4094-bac2-6abf62bc1258
- 2026-09-26 · Анатолий Зверев · Музей AZ
  оставить `moscow-2026-09-26-b82c25d302` (approved)
  повторяет `moscow-2026-10-04-732e936867` (approved) https://museum-az.com/event/ekskursionnyy-marshrut-art-istorii-chistykh-prudov-ot-maroseyki-do-furmannogo-26-09/
- 2026-09-26 · Субботние игры на Платформах · ГЭС-2
  оставить `moscow-2026-09-26-3228c9644f` (rejected)
  повторяет `moscow-2026-09-26-7a4e3eba13` (rejected) https://ges-2.org/saturday-games
- 2026-09-26 · Фотопрогулка-игра «Не путь» · Центр Зотов
  оставить `moscow-2026-09-26-a9cb5c29e5` (approved)
  повторяет `moscow-2026-10-17-a9cb5c29e5` (approved) https://centrezotov.ru/events/fotoprogulka-ne-nyt/
- 2026-09-27 · Анатолий Зверев · Музей AZ
  оставить `moscow-2026-09-27-b82c25d302` (rejected)
  повторяет `moscow-2026-10-04-be9fcb2279` (rejected) https://museum-az.com/event/letal-i-shagal-4-10-let-osen-v-iskusstve/
- 2026-09-30 · Анатолий Зверев · Музей AZ
  оставить `moscow-2026-09-30-b82c25d302` (rejected)
  повторяет `moscow-2026-10-04-89bbe37fe8` (rejected) https://museum-az.com/event/letal-i-shagal-4-6-let-bogi-drevnego-egipta/
- 2026-09-30 · Лекция «Фотография в венгерской литературе. Архив „Фортепан“» · РОСФОТО
  оставить `manual-spb-2026-09-30-rosphoto-fortepan` (approved)
  повторяет `spb-2026-09-30-1384a0ebb0` (rejected) https://rosphoto.org/events/kulturnyj-assamblyazh-dni-vengerskoj-kultury-v-rosfoto-2/
- 2026-10-03 · Анатолий Зверев · Музей AZ
  оставить `moscow-2026-10-03-b82c25d302` (rejected)
  повторяет `moscow-2026-10-04-d3f68bff21` (rejected) https://museum-az.com/event/tvorcheskaya-programma-muzey-naiznanku-dlya-detey-03-10/
- 2026-10-03 · Лекция «Искусство Древней Руси XI–XVII веков» · Третьяковская галерея
  оставить `moscow-2026-10-03-54d5563287` (approved)
  повторяет `moscow-2026-10-17-54d5563287` (approved) https://www.tretyakovgallery.ru/events/o/iskusstvo-drevney-rusi-xi-xvii-vekov-22/
- 2026-10-07 · Лекция « Театральный клуб в Юсуповском дворце на Литейном » · Российская национальная библиотека
  оставить `spb-2026-10-07-9d89a8e682` (approved)
  повторяет `spb-2026-10-21-9d89a8e682` (approved) https://nlr.ru/nlr_visit/event/3639
- 2026-10-08 · Лекция «Дмитрий Левицкий» · Третьяковская галерея
  оставить `moscow-2026-10-01-823eca7e69` (approved)
  повторяет `moscow-2026-10-15-823eca7e69` (approved) https://www.tretyakovgallery.ru/events/o/lektsiya-dmitriy-levitskiy-10-2026/
- 2026-10-09 · Вокальный вечер. Хибла Герзмава и ее класс · Третьяковская галерея
  оставить `moscow-2026-09-23-8ce86966a0` (rejected)
  повторяет `moscow-2026-10-09-8ce86966a0` (rejected) https://www.tretyakovgallery.ru/events/o/vokalnyy-vecher-khibla-gerzmava-i-ee-klass/
- 2026-10-09 · Лекция «Илья Семёнович Остроухов» · Третьяковская галерея
  оставить `moscow-2026-10-02-a54110213e` (approved)
  повторяет `moscow-2026-10-16-a54110213e` (approved) https://www.tretyakovgallery.ru/events/o/lektsiya-ilya-semyenovich-ostroukhov-11-2026/
- 2026-10-21 · Кинопоказ «Классика венгерского кино» · РОСФОТО
  оставить `manual-spb-2026-10-21-rosphoto-hungarian-cinema` (approved)
  повторяет `spb-2026-10-23-b67548fbf4` (approved) https://rosphoto.org/events/kulturnyj-assamblyazh-dni-vengerskoj-kultury-v-rosfoto-2/
- 2026-10-22 · Лекция «Орест Кипренский» · Третьяковская галерея — Инженерный корпус
  оставить `manual-moscow-2026-10-22-kiprensky` (approved)
  повторяет `moscow-2026-10-29-80abf31bf1` (approved) https://www.tretyakovgallery.ru/events/o/lektsiya-orest-kiprenskiy-10-2026/
- 2026-10-24 · Лекция «Павел Третьяков и Виктор Васнецов» · Музей Павла и Сергея Третьяковых
  оставить `moscow-2026-10-24-bcba3b765a` (approved)
  повторяет `moscow-2026-10-30-bcba3b765a` (approved) https://www.tretyakovgallery.ru/events/o/lektsiya-pavel-tretyakov-i-viktor-vasnetsov/
- 2026-10-25 · Лекция «Сентиментализм» · Третьяковская галерея — Инженерный корпус
  оставить `manual-moscow-2026-10-25-sentimentalism` (rejected)
  повторяет `moscow-2026-11-01-c80e7c4770` (rejected) https://www.tretyakovgallery.ru/events/o/lektsiya-sentimentalizm-10-2026/
- 2026-10-30 · Кураторская экскурсия по выставке «Хлеб» · Центр Зотов
  оставить `moscow-2026-09-27-a4e875c14e` (approved)
  повторяет `moscow-2026-10-16-a4e875c14e` (approved) https://centrezotov.ru/events/hleb/kuratorskaya-ekskursiya-po-vystavke-hleb/
  повторяет `moscow-2026-10-30-a4e875c14e` (approved) https://centrezotov.ru/events/hleb/hlebnyj-uikend/kuratorskaya-ekskursiya-po-vystavke-hleb/
- 2026-11-01 · AZ Online · Музей AZ
  оставить `moscow-2026-10-04-12be1ec556` (rejected)
  повторяет `moscow-2026-11-01-12be1ec556` (rejected) https://museum-az.com/az-show/
- 2026-11-01 · Экскурсионный маршрут / От ВХУТЕМАСа до AZ ARTа · Музей AZ
  оставить `moscow-2026-10-04-16f6939347` (rejected)
  повторяет `moscow-2026-11-01-16f6939347` (rejected) https://museum-az.com/event/ekskursionnyy-marshrut-ot-vkhutemasa-do-az-arta-18-10/

## Шум, который новые правила узнают: 53 строк

- `comment_form_boilerplate`: 26
- `generic_section_title`: 4
- `news_portal_not_event`: 23

У строк со статусом approved или rejected причина ниже только справочная. Скрипт их не отклоняет.

- 2026-10-26 В Президентской библиотеке расскажут об отечественном историке Александре Зимине → news_portal_not_event
- 2026-10-26 В декабре зажжется «Волшебный фонарь» → news_portal_not_event
- 2026-10-26 Зрители увидят истории о счастье и семейной памяти в исполнении актеров с РАС → comment_form_boilerplate
- 2026-10-26 Сестрорецкие чтения посвятят городским названиям → comment_form_boilerplate
- 2026-10-26 Воркшопы → generic_section_title
- 2026-10-26 Курсы → generic_section_title

## Пустое время, которое читается из описания: 18

- 2026-09-26 Встреча с мастерами программы «МАТИС: Мастерская театрального искусства для актёров и режиссёров»: поставить 13:00 (сейчас пусто, статус rejected)
- 2026-09-30 Открытый урок по актёрскому мастерству в МАТИС: поставить 19:00 (сейчас пусто, статус rejected)
- 2026-10-02 «Ночь в Манеже» на выставке «Все Бенуа — Всё Бенуа» 17 января 2026 — 18 января 2026: поставить 21:30 (сейчас пусто, статус rejected)
- 2026-10-02 «Ночь в Манеже» на выставке «Все Бенуа — Всё Бенуа» 4 апреля 2026 — 5 апреля 2026: поставить 21:30 (сейчас пусто, статус rejected)
- 2026-10-02 Панельная дискуссия «Наследие Петербурга в «Золотом фонде театральных постановок России» 26 сентября 2026: поставить 14:00 (сейчас пусто, статус rejected)
- 2026-10-02 Показ фильма-выставки «Город-герой Ленинград» в кинотеатре «Аврора» 27 января 2026 17:00 — 18:30: поставить 17:00 (сейчас пусто, статус rejected)
- 2026-10-02 Совещание о предстоящем Едином дне голосования 7 сентября 2026: поставить 12:00 (сейчас пусто, статус rejected)
- 2026-10-03 Каждую субботу в 16:00 — обзорная экскурсия по «Пушкинской-10»: поставить 16:00 (сейчас пусто, статус rejected)
- 2026-10-08 ОБРАЩАЕМ ВНИМАНИЕ! 8 октября МАНЕЖ работает до 18:30. Двери на вход закрываются в 17:00 8 октября 2026: поставить 17:00 (сейчас пусто, статус rejected)
- 2026-10-08 События и выставки: поставить 18:00 (сейчас пусто, статус rejected)
- 2026-10-10 Каждую субботу в 16:00 — обзорная экскурсия по «Пушкинской-10»: поставить 16:00 (сейчас пусто, статус rejected)
- 2026-10-11 Ирония киборгов: коллективная выставка: поставить 19:30 (сейчас пусто, статус approved)
- 2026-10-15 События и выставки: поставить 18:00 (сейчас пусто, статус rejected)
- 2026-10-17 Каждую субботу в 16:00 — обзорная экскурсия по «Пушкинской-10»: поставить 16:00 (сейчас пусто, статус rejected)
- 2026-10-26 В Президентской библиотеке расскажут об отечественном историке Александре Зимине: поставить 14:00 (сейчас пусто, статус new)
- 2026-10-27 Наброски — Наброски на Покровке: поставить 19:00 (сейчас пусто, статус approved)
- 2026-10-29 История искусства как личный опыт. Модуль I. Портрет — опыт саморефлексии: поставить 19:00 (сейчас пусто, статус rejected)
- 2026-11-04 История искусства как личный опыт. Модуль I. Портрет — опыт саморефлексии: поставить 19:00 (сейчас пусто, статус rejected)

## Обрезанные названия: 1

- spb-2026-11-11-2b455f77a1: «Дом Радио и»

## Уже rejected без причины: 578

Им стоит дописать `review_reason`, когда будет понятно, почему строка снята. Автоматически причину не подставляем: решение уже принято.
