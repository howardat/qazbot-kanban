import type { Locale } from "@/lib/i18n";

/** What a change is, shown as a small tag next to it. */
export type ChangeKind = "new" | "improved" | "fixed";

type Change = { kind: ChangeKind; text: Record<Locale, string> };

/** One shipped update, as people see it in the Updates dialog. */
export type Release = { id: string; date: string; title: Record<Locale, string>; changes: Change[] };

/**
 * Patch notes, newest first. Add a release at the top when you ship something people should know
 * about: its id is what profile.updates_seen remembers, so everyone who hasn't opened it yet gets the
 * unread dot. Ids only need to be unique; never change one that has shipped.
 */
export const RELEASES: Release[] = [
  {
    id: "2026-10-30-admin-password-reset",
    date: "2026-10-30",
    title: { en: "Reset a forgotten password", ru: "Сброс забытого пароля" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Admins can give someone a new password on the Access page: press Reset password next to their name, then copy the new password and send it to them.",
          ru: "Админы могут выдать человеку новый пароль на странице «Доступ»: нажмите «Сбросить пароль» рядом с его именем, скопируйте новый пароль и передайте его.",
        },
      },
    ],
  },
  {
    id: "2026-10-29-profile-photos",
    date: "2026-10-29",
    title: { en: "Profile photos", ru: "Фото профиля" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Add your photo on the Avatar page (your name at the bottom of the sidebar → Avatar): it shows next to your name on boards, cards and in the team list.",
          ru: "Добавьте своё фото на странице «Аватар» (ваше имя внизу боковой панели → «Аватар»): оно появится рядом с вашим именем на досках, в карточках и в списке команды.",
        },
      },
    ],
  },
  {
    id: "2026-10-29-cards-rooms-private-boards",
    date: "2026-10-29",
    title: { en: "New cards, private boards and office rooms", ru: "Новые карточки, закрытые доски и комнаты в офисе" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Board cards have a new look: priority and labels on top, then who made the card (with Claude's mark if it was made with Claude) and who it's assigned to, story points and the deadline.",
          ru: "У карточек новый вид: сверху приоритет и метки, внизу — кто создал карточку (со значком Claude, если с его помощью), кому она назначена, стори-поинты и срок.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Cards take story points: set them right on the card or in the card editor.",
          ru: "У карточек появились стори-поинты: их можно поставить прямо на карточке или в редакторе.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Sort a board with the new Order by button: by created date, deadline, priority, story points, title or creator.",
          ru: "Доску можно отсортировать кнопкой «Сортировка»: по дате создания, сроку, приоритету, стори-поинтам, названию или автору.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Private boards: in a board's settings (the ⋯ menu), its owner can pick who sees it. Only those people can see its cards and be assigned to them.",
          ru: "Закрытые доски: в настройках доски (меню ⋯) владелец выбирает, кто её видит. Только эти люди видят её карточки и могут быть на них назначены.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Projects are gone: in the office, rooms belong to boards (named after them, the rest share the open office), and people sit in the room of the board they're working on now.",
          ru: "Проектов больше нет: комнаты в офисе принадлежат доскам (подписаны их названиями, остальные доски делят опенспейс), и человек сидит в комнате доски, над которой сейчас работает.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Your boards come first in the sidebar.",
          ru: "Доски с вашими карточками теперь первыми в меню.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Deadlines are easier to read: red when late (\"2 days late\"), yellow for today and the next two days, grey otherwise.",
          ru: "Сроки читаются проще: красным, если просрочено («Прос. 2 дня»), жёлтым — сегодня и в ближайшие два дня, серым — остальные.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Priority is now just High, Medium or Low; urgent cards became High.",
          ru: "Приоритетов теперь три: высокий, средний и низкий; срочные карточки стали высокими.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Dates no longer show an error on first load in Safari.",
          ru: "В Safari даты больше не вызывают ошибку при открытии страницы.",
        },
      },
    ],
  },
  {
    id: "2026-10-28-feedback",
    date: "2026-10-28",
    title: { en: "Report bugs and ideas", ru: "Сообщайте об ошибках и идеях" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Found a bug or have an idea? Use the new button under Updates in the sidebar to tell us.",
          ru: "Нашли ошибку или есть идея? Расскажите нам через новую кнопку под «Обновлениями» в меню.",
        },
      },
    ],
  },
  {
    id: "2026-10-28-expense-fixes",
    date: "2026-10-28",
    title: { en: "Expenses fixes and safer boards", ru: "Исправления в расходах и защита досок" },
    changes: [
      {
        kind: "improved",
        text: {
          en: "Only the person who created a board can delete it.",
          ru: "Удалить доску теперь может только тот, кто её создал.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "A new category typed in the Add record window now shows up as picked straight away.",
          ru: "Новая категория, введённая в окне «Добавить запись», теперь сразу отображается выбранной.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Invoices attached to expenses upload again.",
          ru: "Счета к расходам снова загружаются.",
        },
      },
    ],
  },
  {
    id: "2026-10-28-expenses",
    date: "2026-10-28",
    title: { en: "Expenses, a new timeline and quicker labels", ru: "Расходы, новый таймлайн и быстрые метки" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Expenses: record spending with invoices, filter by period and category, and export a report in Russian.",
          ru: "Расходы: записывайте траты со счетами, отбирайте по периоду и категории и выгружайте отчёт на русском.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Updates: a dot in the sidebar when something new ships, with every past update kept here.",
          ru: "Обновления: точка в меню, когда выходит что-то новое, а прошлые обновления остаются здесь.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Add or create labels right on a board card, from the new label chip next to its date and priority.",
          ru: "Метки можно добавить или создать прямо на карточке — через новую кнопку рядом со сроком и приоритетом.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "The timeline is rebuilt as a Plane-style gantt chart.",
          ru: "Таймлайн переделан в диаграмму Ганта в стиле Plane.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Labels are picked the same way everywhere: search, tick several, or type a new one.",
          ru: "Метки везде выбираются одинаково: поиск, несколько сразу или новая прямо из поиска.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "New cards can get a deadline, priority and people while you type the title.",
          ru: "Новой карточке можно сразу задать срок, приоритет и исполнителей, пока пишете название.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Opening a card from its ⋯ menu no longer closes the side panel straight away.",
          ru: "Карточка, открытая через меню ⋯, больше не закрывается сразу.",
        },
      },
      {
        kind: "fixed",
        text: {
          en: "Clicking the empty part of a card's property row opens the card.",
          ru: "Клик по пустому месту в строке свойств карточки теперь открывает её.",
        },
      },
    ],
  },
  {
    id: "2026-10-28-plane",
    date: "2026-10-28",
    title: { en: "A cleaner look, labels and talk mode", ru: "Новый вид, метки и голосовой режим" },
    changes: [
      {
        kind: "improved",
        text: {
          en: "Boards, the list, calendar and timeline share one calmer, Plane-style design.",
          ru: "Доски, список, календарь и таймлайн в едином спокойном стиле в духе Plane.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Cards open in a side panel, so the board stays in view while you edit.",
          ru: "Карточка открывается в боковой панели, и доска остаётся на виду.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Labels have their own manager and one name everywhere they appear.",
          ru: "У меток появился свой редактор и одно название везде.",
        },
      },
      {
        kind: "new",
        text: {
          en: "Talk to the assistant out loud with live speech recognition.",
          ru: "С ассистентом можно говорить голосом, речь распознаётся на лету.",
        },
      },
    ],
  },
  {
    id: "2026-10-27-team",
    date: "2026-10-27",
    title: { en: "Team dashboard, avatars and your own AI keys", ru: "Дашборд команды, аватары и свои ключи ИИ" },
    changes: [
      {
        kind: "new",
        text: { en: "Team has a classic dashboard next to the 3D office.", ru: "В разделе «Команда» появился дашборд рядом с 3D-офисом." },
      },
      {
        kind: "new",
        text: { en: "Pick one of 20 avatars for your office figure and icon.", ru: "Выберите один из 20 аватаров для фигуры в офисе и иконки." },
      },
      {
        kind: "new",
        text: { en: "Bring your own OpenRouter key for the assistant.", ru: "Можно подключить свой ключ OpenRouter для ассистента." },
      },
      {
        kind: "new",
        text: {
          en: "Quick deadline, priority and assignee buttons on board cards.",
          ru: "Быстрые кнопки срока, приоритета и исполнителя на карточках.",
        },
      },
      {
        kind: "improved",
        text: {
          en: "Pages load faster: the app now runs next to the database in Frankfurt.",
          ru: "Страницы грузятся быстрее: приложение работает рядом с базой во Франкфурте.",
        },
      },
    ],
  },
  {
    id: "2026-10-27-launch",
    date: "2026-10-27",
    title: { en: "Qazbot Kanban is live", ru: "Qazbot Kanban запущен" },
    changes: [
      {
        kind: "new",
        text: {
          en: "Boards with columns and cards, plus calendar and timeline views.",
          ru: "Доски с колонками и карточками, а также календарь и таймлайн.",
        },
      },
      {
        kind: "new",
        text: { en: "An AI assistant that can read and update your boards.", ru: "ИИ-ассистент, который читает и обновляет доски." },
      },
      {
        kind: "new",
        text: {
          en: "MCP access, so other AI tools can work with the kanban.",
          ru: "Доступ по MCP, чтобы другие ИИ-инструменты работали с канбаном.",
        },
      },
      {
        kind: "new",
        text: { en: "Invite-only accounts with email and password.", ru: "Аккаунты только по приглашению, вход по почте и паролю." },
      },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0].id;
