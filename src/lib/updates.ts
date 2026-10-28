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
      {
        kind: "new",
        text: {
          en: "Updates: a dot in the sidebar when something ships, with every past update kept here.",
          ru: "Обновления: точка в меню, когда выходит что-то новое, а прошлые остаются здесь.",
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
