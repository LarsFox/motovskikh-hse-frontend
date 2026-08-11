"use strict";

export function messages(lang) {
    const ru = lang !== "en";
    return {
        buildPrompt: ru
            ? "Кликните соседнюю страну и введите её название."
            : "Click a neighbouring country and type its name.",

        selectionCancelled: ru ? "Выбор отменён." : "Selection cancelled.",

        startPrompt: (name, attempts) => {
            const hl = `<br><span class="highlightCountry">${name}</span>`;
            return ru
                ? `Найдите на карте стартовую страну:${hl}<br>(попыток: ${attempts})`
                : `Find the start country on the map:${hl}<br>(attempts: ${attempts})`;
        },

        startMiss: (left) => (ru
            ? `Мимо! Осталось попыток: ${left}`
            : `Miss! Attempts left: ${left}`),

        startAuto: (name) => (ru
            ? `Это была ${name}. Кликните соседнюю страну и введите её название.`
            : `It was ${name}. Click a neighbouring country and type its name.`),

        startCorrect: ru
            ? "Верно! Кликните соседнюю страну и введите её название."
            : "Correct! Click a neighbouring country and type its name.",

        alreadyInRoute: ru ? "Эта страна уже в маршруте." : "Already in the route.",

        countrySelected: ru
            ? "Страна выбрана. Введите её название."
            : "Country selected. Type its name.",

        clickFirst: ru
            ? "Сначала кликните страну на карте."
            : "First click a country on the map.",

        wrongName: ru
            ? "Это не выбранная страна. Попробуйте ещё раз."
            : "That's not the selected country. Try again.",

        ruleBreakNamed: (to) => (ru
            ? `Верно, это ${to}, но ход не по правилу задания.`
            : `Correct, it's ${to}, but the move breaks the task rule.`),

        ruleBreak: ru ? "Ход не по правилу задания." : "The move breaks the task rule.",

        revealed: (name) => (ru ? `Это ${name}.` : `It's ${name}.`),

        added: (name) => (ru ? `Добавлено: ${name}.` : `Added: ${name}.`),

        removed: (name) => (ru ? `Убрано: ${name}.` : `Removed: ${name}.`),

        routeCleared: ru ? "Маршрут очищен." : "Route cleared.",

        skipped: ru
            ? "Раунд пропущен. Штраф: −300 очков."
            : "Round skipped. Penalty: −300 points.",

        roundComplete: (count, earned) => (ru
            ? `Раунд пройден! Маршрут из ${count} стран. +${earned} очков.`
            : `Round complete! Route of ${count} countries. +${earned} points.`),

        timeUp: ru ? "Время вышло!" : "Time's up!",

        settingsTimeoutRequired: ru
            ? "При бесконечных раундах нужен таймаут!"
            : "Timeout is required for infinite rounds!",

        airflightPrompt: ru
            ? "Режим перелёта: кликните любую страну."
            : "Flight mode: click any country.",

        airflightUsed: (name) => (ru
            ? `Перелёт в ${name}.`
            : `Flight to ${name}.`),

        airflightNoLeft: ru
            ? "Перелёты закончились."
            : "No flights left.",

        airflightBtn: (left) => (ru
            ? `Использовать перелёт (осталось ${left})`
            : `Use flight (${left} left)`),

        airflightBtnOff: ru
            ? "Использовать перелёт"
            : "Use flight",
    };
}

export function taskMessages(lang) {
    const ru = lang !== "en";
    return {
        langSuffix: (taskLang) => {
            if (taskLang === "ru") {
                return ru ? "на русском" : "in Russian";
            }
            return ru ? "на английском" : "in English";
        },

        lengthOnly: (length) => (ru
            ? `Постройте маршрут из ${length} стран.`
            : `Build a route of ${length} countries.`),

        alphaOrder: (length, direction, langName) => {
            if (direction === "desc") {
                return ru
                    ? `Постройте маршрут из ${length} стран, где каждая следующая страна идёт раньше по алфавиту, чем предыдущая (${langName}).`
                    : `Build a route of ${length} countries where each next country comes earlier alphabetically than the previous one (${langName}).`;
            }
            return ru
                ? `Постройте маршрут из ${length} стран, где каждая следующая страна идёт позже по алфавиту, чем предыдущая (${langName}).`
                : `Build a route of ${length} countries where each next country comes later alphabetically than the previous one (${langName}).`;
        },

        lastLetter: (length, langName) => (ru
            ? `Постройте маршрут из ${length} стран, где каждая следующая страна начинается на последнюю букву предыдущей (${langName}).`
            : `Build a route of ${length} countries where each next country starts with the last letter of the previous country (${langName}).`),

        startLetter: (length, letter, langName) => (ru
            ? `Постройте маршрут из ${length} стран, названия которых начинаются на букву «${letter}» (${langName}).`
            : `Build a route of ${length} countries whose names all start with the letter "${letter}" (${langName}).`),

        endIn: (length, name) => (ru
            ? `Постройте маршрут из ${length} стран, заканчивающийся в стране ${name}.`
            : `Build a route of ${length} countries ending in ${name}.`),
    };
}
