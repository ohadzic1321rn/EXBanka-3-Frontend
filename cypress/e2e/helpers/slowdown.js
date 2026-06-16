// Slow the test run down for more watchable recordings.
//
// Cypress has no literal "playback speed" knob — commands don't carry an
// intrinsic duration you can scale by a percentage. The standard technique is
// to insert a fixed delay before each interactive command. With the short
// Celina specs a ~250 ms delay stretches the run to roughly three-quarters of
// its natural pace (i.e. ~75% speed). Tune COMMAND_DELAY to taste — set it to 0
// to disable.
//
// Note: only real "commands" can be overwritten this way. In Cypress 15
// `contains`/`get` are queries (overwriteQuery), so they're intentionally left
// out — delaying the action commands below is what visibly slows the playback.
const COMMAND_DELAY = 250

const slowedCommands = ['visit', 'click', 'trigger', 'type', 'clear', 'reload', 'select', 'check', 'uncheck']

for (const command of slowedCommands) {
  Cypress.Commands.overwrite(command, (originalFn, ...args) => {
    const origVal = originalFn(...args)
    return new Promise((resolve) => {
      setTimeout(() => resolve(origVal), COMMAND_DELAY)
    })
  })
}
