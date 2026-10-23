# Research report: features that would add value to the recurring-expense PWA

**How this was researched.** WebFetch could not reach any site from this sandbox: the egress proxy refused the connections (for example `support.ynab.com` with a 403, `getfinny.app` with a DNS failure). Every fact below therefore comes from WebSearch summaries of the cited pages. I did not open the full pages. Labels used:
- **[V]** the vendor's own docs, help centre, blog or store listing, as surfaced by search
- **[3P]** third-party reviews, forums or competitor blogs
- **[I]** my own inference

The repo was read only, to judge fit. No files were changed.

## 0. Most urgent: the likely cause of "Gemini works terribly"

- **The configured model is probably blocked.** `src/app/api/ai/parse-expenses/route.ts` defaults to `gemini-2.5-flash`.
  - The Gemini API release notes of Sep 18, 2026 say 2.5 models are now limited to users who used them recently. For new projects Google recommends 3.5 Flash-Lite or 3.8 Flash. [V] https://ai.google.dev/gemini-api/docs/changelog
  - The deprecations page lists no shutdown date now. An earlier version said Oct 16, 2026. [V] https://ai.google.dev/gemini-api/docs/deprecations
  - Developers widely report a 404 "no longer available to new users" for 2.5-flash. [3P] https://discuss.ai.google.dev/t/gemini-2-5-flash-and-gemini-2-5-flash-lite-returning-404-no-longer-available-today-july-9-contradicts-oct-16-2026-shutdown-date/174267 and https://dev.to/nils44344/gemini-25-flash-no-longer-available-to-new-users-404-61n
  - gemini-3.8-flash was released Sep 2, 2026. It has thinking levels low, medium and high, with medium as the default. [V] https://ai.google.dev/gemini-api/docs/latest-model
  - On Oct 8, 2026, 3.5 and 3.7 Flash were deprecated and now route to 3.6 and 3.8. [V] changelog above
  - **[I]** The route turns any non-429, non-5xx status into `invalid_response` and falls back to the local regex parser. A 404 is therefore silent: the user just gets the weak local parse.
- **Other weak points in the route [I]:**
  - It has no `responseSchema` and no enums.
  - It doesn't send today's date, so relative dates like "el 5" or "cada año en marzo" can't be resolved.
  - It doesn't send the user's existing category names.
  - The prompt is Spanish-only, although the app also supports English.
  - The 8 s timeout is tight, because thinking is on by default. `thinkingBudget: 0` on 2.5 Flash, or `thinking_level: low` on 3.8 Flash, would help. [V] https://firebase.google.com/docs/ai-logic/thinking
  - The client only uses `expenses[0]`.

## 1. Month rollover and budget period

- **Budget period that starts on payday:**
  - Emma lets the cycle follow payday: weekly, every 2 or 4 weeks, a fixed date from the 1st to the 28th, or the last working day. The "penultimate working day" option was added in June 2025, and the budget "resets the day your salary arrives". [V] https://emma-app.com/blog/new-in-emma-custom-budgeting-periods-that-match-your-payday and https://emma-app.com/blog/payday-sync-budgets-track-salary
  - A moderator said early payment isn't supported. [3P, possibly outdated] https://community.emma-app.com/t/custom-budget-dates/7758
  - Monzo: "Set Payday" from the month picker, by picking the salary transaction, or any transfer of at least £200, that starts the month. Weekly and biweekly pay are not supported. [V] https://monzo.com/help/budgeting-overdrafts-savings/how-to-set-payday
  - Users complain that a fixed reset date breaks insights when pay arrives early. [3P] https://community.monzo.com/t/reset-trends-date-dynamically-on-payday/186709
  - Wallet (BudgetBakers) has an "Initial day of the month" setting, on Android only. [V] https://support.budgetbakers.com/hc/en-us/articles/12212663489298-Setup-Initial-day-of-the-month
  - Goodbudget offers Monthly, Weekly, Semi-Monthly or Every-2-Weeks periods. [3P forum] https://forums.goodbudget.com/t/starting-a-new-budget-period/1180
  - Finary lets you move the start date, for example a 25th-to-24th month. [V] https://help.finary.com/en/articles/11501870-set-a-custom-date-range-for-my-budget
  - Money Manager has a "change of starting date" option. [V] https://apps.apple.com/app/id395153197
  - YNAB, Monarch and Copilot appear to use calendar months only. [3P competitor blog, unverified] https://getfinny.app/blog/budget-apps-custom-month-start
- **Design rule from that same source [3P]:** limit the start day to 1–28, or use "last working day" semantics, so February doesn't silently produce a different-length period. Totals, charts and history must all move with the period.
- **"Getting a month ahead":**
  - In YNAB you assign money to next month. A progress tracker appears, and a checkmark shows when that month is fully funded. Positive balances roll over; overspending does not. [V] https://support.ynab.com/en_us/getting-a-month-ahead-HJidy13C5
  - EveryDollar lets you create next month's budget early by copying the current one; Ramsey suggests doing it in the last week. There is also a "close out your monthly budget" ritual. The catch: later edits to the current month don't flow into a future month that already exists. [V] https://everydollar.help.ramseysolutions.com/hc/en-us/articles/42988235371021-How-to-Create-Next-Month-s-Budget-in-EveryDollar and https://ramseysolutions.com/budgeting/how-to-close-out-your-monthly-budget
- **Gap [I]:** I found no app that explicitly asks "everything is paid, move to next month?". YNAB's checkmark and EveryDollar's "start planning next month" button are the closest. This is a chance to stand out.

## 2. Paying next month's bills early

- **Principle [I], based on YNAB guidance:** keep the real payment date, but attribute the payment to the period it covers. YNAB says to record transactions as they happen and to fund the future month. [V] https://support.ynab.com/en_us/getting-a-month-ahead-HJidy13C5
- **Spreadsheet workaround:** Tiller users re-date the transaction instead. [3P] https://community.tiller.com/t/how-to-account-for-budget-items-that-are-paid-early/667
- **A bill tracker hitting the same problem:** the open-source "funded" tracker has issue #211, asking for a persistent "Paid for <Month>" label set on every mark-as-paid, including paying early, with Undo and Mark-unpaid handled. [3P] https://github.com/mp3anthony/funded/issues/211
- **Monarch's calendar:** you can move to future months; paid items are green with a check and missed ones are red with an X. Bill Sync marks a bill paid when a matching transaction appears before the due date. [V] https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills and https://help.monarch.com/hc/en-us/articles/29446697869076-Getting-Started-with-Bill-Sync
- **Fit [I]:** the app's model already separates `paidAt` from the occurrence's `occurrenceDate` and `monthId`, so this is mostly a UX and navigation change, not a data-model change.

## 3. Subscription insights

- **Price-increase alerts:**
  - Rocket Money alerts when a charge rises by more than $1.99 and more than 5%. [V] https://www.rocketmoney.com/learn/personal-finance/is-there-an-app-that-can-tell-me-when-my-subscription-price-increased
  - It also reminds you when free trials are about to end. [V] https://apple.co/35oj1nj
  - Snoop caught a £20 Sky price rise for one user, who then negotiated it down. [V user story] https://snoop.app/stories/stacey/a-sneaky-price-hike
  - Detection is usually retrospective (after you've paid the higher price) and often misses annual plans. [3P] https://getfinny.app/blog/apps-track-subscription-price-increases-2026
- **Price history and totals:**
  - SubTracker keeps a price history plus a "Total Spent" figure per subscription. [V listing] https://apps.appfollow.io/ios/subtracker-subscriptions/6759149326?country=ca
  - Subtrax and SubTab normalise everything to annual or monthly totals. [V listings]
- **Trials and cost per day:**
  - Subby records the trial end date and the price it converts to. A week before, a card shows what cancelling saves in a year. The home total shows cost per day. [V] https://play.google.com/store/apps/details?id=com.slapp.subby&hl=en_US
- **Reminder lead time:**
  - Annual plans need 30 or more days' notice to cancel in time; monthly ones need a few days. [3P vendor argument] https://subtracker.io/best/how-to-never-miss-a-subscription-renewal
  - Bobby lets you set reminders days or weeks ahead. [3P] MacStories review (macstories.net)
  - **[I]** This app caps `daysBeforeCharge` at 1–5 days.

## 4. Calendar, forecast and "left after bills"

- **"Left over" / "safe to spend":**
  - PocketGuard's "Leftover" is income minus bills, budgets and goals, and resets on the 1st. [V] https://pocketguard.com/help/leftover
  - Simplifi's Spending Plan subtracts bills, transfers and savings goals from projected income. [3P] https://www.thepennyhoarder.com/budgeting/simplifi-app/
  - Emma shows "committed spending" for the period plus a countdown in days to the next salary. [V] https://help.emma-app.com/en/category/budgeting-1s6usi4/
  - Snoop shows a timeline of bills against your balance and warns if bills might not be covered. [V] https://apps.apple.com/gb/app/budget-planner-l-snoop-money/id1495077102
  - Wallet shows the expected balance after planned payments. [V] https://budgetbakers.com/planned-payments
- **Forecasts and calendars:**
  - Chronicle Pro has a Forecast View showing what's due every month for 12 months, and "Amount to Save" for non-monthly bills. [V] https://apps.apple.com/app/id572561420
  - Monarch has a recurring calendar and a cash-flow forecast. [3P] https://www.thepennyhoarder.com/budgeting/monarch-money-review/
  - Copilot's Recurring view is split into This Month, In the Future, Paused and Archived. [V] https://help.copilot.money/en/articles/3760068-create-recurrings

## 5. Quick entry: voice, natural language, shortcuts

- **Mainstream apps:**
  - YNAB on iOS 26 can add transactions via Siri and Spotlight, and Lock Screen shortcuts need iOS 18+. [V] https://support.ynab.com/en_us/using-siri-and-spotlight-with-ynab-B1Me9dj5ge
  - Copilot and Monarch are reported to have no voice entry. [3P] https://getfinny.app/blog/best-ai-chat-expense-trackers-2026
  - Voice-first niche apps exist (Money Vault, VoCash, DrakeAI, Tally), but the reviews are mostly promotional. [3P] https://aimoneyvault.app/resources/articles/best-voice-first-budget-apps
- **What works in an iOS PWA:**
  - The Web Speech API is **not available in home-screen web apps**. WebKit bug 225298 was closed as RESOLVED LATER, last modified March 2025. [V] https://bugs.webkit.org/show_bug.cgi?id=225298
  - getUserMedia and MediaRecorder work in iOS PWAs, but the mic can fail after the app is relaunched. [V forum] https://developer.apple.com/forums/thread/797987 and https://bugs.webkit.org/show_bug.cgi?id=252465
  - Gemini accepts inline audio up to 20 MB per request, including WEBM, MP4/M4A, AAC and OPUS. [V] https://ai.google.dev/gemini-api/docs/audio and https://firebase.google.com/docs/ai-logic/input-file-requirements
- **Recommended approach [I]:**
  - Record with MediaRecorder, send the audio to the server, and have Gemini transcribe and extract into a JSON schema in a single call.
  - In Chrome on Android, Web Speech can give live text instead.
  - The iOS keyboard dictation key already works in the existing text field, at zero cost.
  - Always show a confirmation form before saving.
- **Other platform limits:**
  - App icon badges work in iOS 16.4+ home-screen apps, but need notification permission. [V] https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
  - iOS home-screen widgets aren't possible for a PWA. [I]

## 6–9. Households, variable bills, feedback, export

- **Households:**
  - Monarch launched Shared Views on Oct 30, 2025, with "mine / theirs / ours" labels and one subscription per household. [V] https://www.monarch.com/blog/shared-views
  - YNAB Together allows sharing with up to 6 people. [3P]
  - Splitwise is built around splitting recurring bills. [3P]
  - Chronicle can share bills with a partner via cloud sync. [V]
- **Variable bills:**
  - Chronicle estimates the amount due from the type of bill, your payment history and the time of year. [V] https://chronicleapp.com/?p=849
  - Quicken offers an average of previous bills, and a seasonal estimate once a bill has 12 payments. [3P] https://community.quicken.com/discussion/comment/18846014
  - Bill Boss uses a manual "next amount" field. [V]
- **Payments:** Bills Monitor supports full or partial payments with a note, a badge counting overdue bills, a calendar and history. [V] https://apps.apple.com/us/app/bills-monitor-bill-reminder/id473477150
- **Monthly reviews and celebration:**
  - Copilot's Month and Year in Review appears at the start or end of each month and has shareable slides. [V] https://help.copilot.money/en/articles/10310024-month-and-year-in-review
  - Monarch has a Monthly Progress Report. [V] https://help.monarch.com/hc/en-us/sections/32460819487124-Using-Monarch
  - Evidence that streaks or confetti help is weak and comes mostly from vendor claims. RevenueCat (July 2025) argues streaks alone fall short. [3P] https://www.revenuecat.com/blog/growth/gamification-in-apps-complete-guide
- **Export and calendar sync:**
  - YNAB exports two CSVs (plan and transactions), from the web app only. [V] https://support.ynab.com/en_us/how-to-export-plan-data-Sy_CouWA9
  - Toshl exports CSV, Excel and PDF. [V] https://toshl.com/blog/
  - Money Manager backs up to Excel. [V]
  - SubTracker offers a free ICS calendar feed you subscribe to once from Google, Apple or Outlook. [V] https://subtracker.io/build/ics-calendar-feed-subscriptions
  - Users ask for Google Calendar integration. [3P] https://www.capterra.be/reviews/165241/trackmysubs
  - **[I]** I found no export feature in this app.

## Ranked feature ideas

**Must-do fix:** move the Gemini model to `gemini-3.8-flash` or `gemini-3.5-flash-lite`, keep it configurable, and show a 404 as "model unavailable" instead of silently falling back.

| # | Feature | Who does it | Why it matters | Fit |
|---|---|---|---|---|
| 1 | **"Month done → move to next month" prompt.** When every occurrence in the period is paid or skipped, or payday has passed, show a sheet like "October closed: 12/12 paid, €X. Go to November?" with options "Go", "Stay" and "Always automatic". Unpaid occurrences carry into the new month as "Overdue". | YNAB month-ahead checkmark; EveryDollar plan next month; Ramsey close-out ritual | The owner's main pain point; I found no app that explicitly asks | **High** |
| 2 | **Period that starts on payday.** Start the month on salary day (1–28, or "last/penultimate working day"), reusing the existing `MonthlySalarySettings.dayOfMonth` | Emma, Monzo, Wallet, Goodbudget, Finary, Money Manager | Spanish salaries often arrive before the 1st [I]; Monzo users complain about fixed reset dates | **High** |
| 3 | **Pay early with clear attribution.** Mark a future occurrence paid from "Upcoming", and show "Paid on 28 Oct · covers November" | funded #211; Monarch future-month calendar | Users can't tell what's already covered | **High** |
| 4 | **"Free until payday".** Salary minus pending bills before next payday minus savings goal, with a days-to-payday counter | PocketGuard, Simplifi, Emma, Snoop, Wallet | Core question for someone who tracks bills; the app already has all the inputs | **High** |
| 5 | **Lead times per frequency and renewal/cancel-by reminders.** Allow 7, 14 or 30 days for annual and quarterly items, plus a "cancel before" date and a trial flag | Subby, Rocket Money, Bobby, SubTracker | Annual renewals such as insurance are the ones people miss; the current 1–5 day cap is too short | **High** |
| 6 | **Price change detection with series update.** If the paid amount differs from the planned one, ask "Update the amount from now on?"; keep a price history and show the annual impact | Rocket Money, Snoop, SubTracker | Price rises are silent; this works without bank linking | **High** |
| 7 | **Data export (CSV/JSON) and restore** | YNAB, Toshl, Money Manager, Tilla | Trust, portability, backups; cheap to build | **High** |
| 8 | **Voice entry and a better AI parser.** MediaRecorder → Gemini audio with a JSON schema, today's date and the category list; multiple expenses per sentence; a review screen before saving | YNAB Siri; voice-first apps | Explicitly requested; Copilot and Monarch lack it | **High** (iOS caveats in §5) |
| 9 | **Monthly set-aside for annual and non-monthly bills** ("Set aside €X/month") | Chronicle Amount to Save; YNAB sinking funds | Smooths out big annual hits | **High** |
| 10 | **Variable bills: estimated vs actual.** Suggest the next amount from the last 3 payments or the same month last year, and show the difference | Chronicle, Quicken | Electricity and water are the main source of surprises | **Med-High** |
| 11 | **Month recap and a low-key "month complete" moment**, linked to item 1 | Copilot Month in Review; Monarch Progress Report | A ritual that brings people back; avoid streak pressure | **Medium** |
| 12 | **Subscription insights**: annual total, cost per day, normalised monthly cost, total spent since start | Subby, Subtrax, SubTracker | Makes the yearly cost visible | **Medium** |
| 13 | **App icon badge** counting overdue or due-today items | Bills Monitor; iOS 16.4+ Badging API | Low effort, since push permission already exists | **Medium** |
| 14 | **Month calendar view** with paid/upcoming/missed colours, and a 12-month forecast | Monarch, Chronicle Forecast, Bills Monitor | Complements the timeline | **Medium** |
| 15 | **ICS calendar feed** (tokenised subscribe URL) | SubTracker | Requested by users; needs a server endpoint | **Medium** |
| 16 | **Payment method per bill**, plus partial payments | Bills Monitor, Money Manager | Know which account needs funds before each charge | **Med-Low** |
| 17 | **Brand catalogue and templates** (logos, default cycle) | Subby (600+), SubTracker (600+) | Faster manual entry | **Med-Low** |
| 18 | **Household sharing** (shared series, "my share %") | Monarch Shared Views, YNAB Together, Splitwise | Valuable, but a big change to RLS and the data model; start with a split % field | **Low-Med** |
| 19 | **Android manifest shortcuts**, plus iOS Shortcuts "Open URL" deep links like `/new?text=` [I] | YNAB/Copilot do this natively | Fast capture with no native app | **Low-Med** |

What stays unverified: exact Monarch and Copilot period settings, Spendee and Fintonic's 2025–26 recurring features, and the current target of `gemini-flash-latest` (it was 3.5-flash as of May 2026). Check these against the official pages before committing.
