## CozyCrowns 👑
A character sheet manager for the TTRPG [Brindlewood Bay](https://www.gauntlet-rpg.com/brindlewood-bay.html)

You can check it out here: https://cozycrowns.odin-matthias.de

## How to run
* `npm isntall` (yes, *isntall*)
* `npm run dev` to start dev server
* `npm run build` to generate production build


## Fonts
* CozyCrowns uses fonts from [google fonts](https://fonts.google.com) that were tranformed into woff2 for effiency with [ttf2woff2](https://www.npmjs.com/package/ttf2woff2)


## Translations
Translations are managed with [lingui](https://lingui.dev). 

To translate a new text:
* Wrap it in either the `<Trans>` macro component or use the `t` macro for text outside of components
* Run `npm run extract` to add new translation keys to all `messages.po` files under `src/locales`
* Update the translations in each `messages.po`
* Run `npm run compile` to update the `message.ts` files with latest translations

To add a new language:
* Add the new locale in `lingui.config.js` locales
* Run `npm run extract` to create `src/locales/{your-locale}/messages.po`
* Fill your translations into that file & run `npm run compile`
* Add your new locale to `loadTranslations` in `src/lib/utils.ts`

## Analytics
* CozyCrowns uses [posthog](https://posthog.com) for analytics
* Create a `.env` file based on `.env.sample` to enable analytics with your API key

## Credits
* Brindlewood Bay is published by [The Gauntlet](https://www.gauntlet-rpg.com/brindlewood-bay.html)
* Queen SVG by [Darius Dan on svgrepo](https://www.svgrepo.com/svg/317455/queen)
* Tentacles icon by [Teewara soontorn on Noun Project](https://thenounproject.com/icon/tentacles-4112037/)
<!-- 

TODOdin: Add more eldritch elements to the site as void crowns get checked off
TODOdin: Add u18n with https://github.com/lingui/js-lingui
TODOdin: See if you can get some simple free storage with firebase or something..?
TODOdin: Add Dark Conspiracy sheet
 -->