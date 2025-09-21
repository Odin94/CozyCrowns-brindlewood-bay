import { t } from "@lingui/core/macro"

export const getEndOfSessionQuestions = () => [
    t`Did the Murder Mavens solve a mystery?`,
    t`Did you secretly undermine the authority of a local official?`,
    t`Did you share your wisdom with a young person?`,
    t`Did you share a memory of a late family member?`,
    t`Did you behave like a woman half your age?`,
    t`Did you dote on someone?`,
    t`Did you show someone that you've "still got it?"`,
]

export const getAdvancementOptions = () => [
    t`Increase an ability modifier by 1 (max +3).`,
    t`Increase an ability modifier by 1 (max +3).`,
    t`Choose an additional Maven move.`,
    t`Choose an additional Maven move.`,
    t`Unmark all the items in your Cozy Little Place.`,
]

export const getCrownsOfTheQueen = () => [
    t`A flashback of your fondest memory of your late partner.`,
    t`A flashback showing how you were an imperfect sister or daughter.`,
    t`A flashback showing how you were an imperfect mother.`,
    t`A flashback of your fondest memory with one of your children.`,
    t`A scene in the present day showing a private side of you very few get to see.`,
    t`A scene in the present day showing a burgeoning romance.`,
    t`A scene in the present day showing how you satisfy your physical desires.`,
]

export const getCrownOfTheVoid = () => [
    {
        title: t`A Shadow in the Garden.`,
        description: t`Hereafter, during cozy vignettes focused on you or Cozy Move scenes involving you, you must also narrate how dark entities subtly reveal themselves in the scene.`,
    },
    { title: t`The Chariot.`, description: t`Your Reason modifier is reduced by 1 and your Sensitivity modifier is increased by 1.` },
    {
        title: t`The Pallid Mask.`,
        description: t`Hereafter, during any intimate conversation with another character, you must make a casual reference to death, dying, the afterlife, or the End of All Things—no matter the subject at-hand.`,
    },
    { title: t`The Pomegranate Kernel.`, description: t`You gain the condition 'Obsessed with the Void'. It can never be removed.` },
    { title: t`The Void.`, description: t`Retire your character in a way that shows how they are lost to the Void.` },
]

export const sampleNames = [
    "Barbara",
    "Billy",
    "Birdie",
    "Daisy",
    "Doris",
    "Ernestine",
    "Georgina",
    "Hyacinth",
    "Jane",
    "Jessica",
    "Laura",
    "Louise",
    "Marilyn",
    "Mavis",
    "Maxine",
    "Muriel",
    "Nellie",
    "Opal",
    "Pearl",
    "Rosemary",
    "Ruby",
    "Ruth",
    "Violet",
]

export const getSampleStyles = () => [
    t`Alexis Carrington Colby`,
    t`All the Cardigans`,
    t`Blouse Barn`,
    t`Dorothy Zbornak`,
    t`Goin' Fishin'`,
    t`Hippy Dippy`,
    t`Jackie O`,
    t`Martha's Vineyard`,
    t`Office Hours`,
    t`Speed Walkin'`,
    t`Up in Pumps`,
]

export const getSampleActivities = () => [
    t`Antiques & Furniture`,
    t`Baking`,
    t`Birding`,
    t`Charity Events`,
    t`Collecting (Stamps, Buttons, Pressed Flowers, ...)`,
    t`Cooking`,
    t`Gardening`,
    t`Knitting`,
    t`Painting`,
    t`Pottery`,
    t`Quilting`,
    t`Scrapbooking`,
]

export const getMavenMoves = () => [
    {
        title: "B.A. Baracus",
        summary: t`Avoid physical harm once per mystery`,
        description: t`Once per mystery, if you and/or any number of your fellow Mavens would suffer physical harm, you can describe how that physical harm is just narrowly avoided.`,
    },
    {
        title: "Tom Hanson",
        summary: t`Pass for younger with advantage on rolls`,
        description: t`You can easily pass for someone much younger. If you're in a situation or environment where being younger is a benefit, your rolls are made with advantage.`,
    },
    {
        title: "Milton Hardcastle",
        summary: t`End of Session: "Did you inflict extrajudicial punishment on a wrongdoer?"`,
        description: t`You have an additional End of Session question that is always marked: "Did you inflict extrajudicial punishment on a wrongdoer?"`,
    },
    {
        title: "Jonathan Hart",
        summary: t`+1 Presence from jet set lifestyle`,
        description: t`You used to live a globetrotting, jet set life, and you still have a touch of glamor about you that will never fade. Add 1 to your Presence (max 3).`,
    },
    {
        title: "Angus MacGyver",
        summary: t`Improvise with objects for automatic 12+`,
        description: t`When you improvise in a situation using whatever is at-hand, ask the other players and Keeper to name three objects you find in the environment. So long as you can give a plausible explanation for how these three objects together are helpful in the current situation, you get an automatic 12+ on a single associated die roll. This move can be used once per mystery.`,
    },
    {
        title: "Thomas Magnum",
        summary: t`Access to Robin's resources outside Brindlewood Bay and get both Gold Crown benefits`,
        description: t`You are a secret personal friend of Robin Masterson, the mysterious author of The Gold Crown Mysteries. You have access to Robin's resources whenever you are outside Brindlewood Bay: her homes, her vehicles, and even her checking account. Additionally, the Mavens always get both benefits of the Gold Crown Mysteries Move instead of having to choose.`,
    },
    {
        title: "Fox Mulder",
        summary: t`Dark conspiracy informant helps with Void Clues`,
        description: t`Someone connected to the dark conspiracy is helping you behind the scenes. Tell the Keeper that the thresholds for each layer of the dark conspiracy are reduced by 1. Once per mystery, after at least one Void Clue has been encountered, you can have a secret meeting with this informant, who is always shrouded in darkness or otherwise disguised. You need only describe what the scene looks like—the location, the physical environment, how the mysterious person arrives on the scene, etc. The actual conversation happens off-screen. Then, you can declare that a Void Clue encountered during the mystery is now a regular Clue. The informant will only fully reveal themselves during the Void Mystery, at which point you can have normal scenes with them. No two Mavens can have this move at the same time.`,
    },
    {
        title: "Michael Knight",
        summary: t`Trusty vehicle for advantage on rolls`,
        description: t`You have a trusty mode of transportation—an oversized sedan, a motorbike, or an old truck—that has gotten you out of more than one sticky situation. Give it a name and add it to your Cozy Little Place. When you use it to get an advantage on a die roll, leave it unmarked.`,
    },
    {
        title: "Rick & A.J.",
        summary: t`Opposite sibling for help, gives advantage (but helps at a cost)`,
        description: t`You have a sibling who is your polar opposite in terms of fashion sense and personality. Describe them to the Keeper and name them. You can always request a scene with your sibling. You can also call on them for help, in which case you take advantage on any die rolls associated with actions they assist you with. However, that help always comes at a cost.`,
    },
    {
        title: "R. Quincy",
        summary: t`Medical background and Medical Bag that never gets marked`,
        description: t`You have a medical background; describe it. Then add a Medical Bag to your Cozy Little Place. When you use it to get an advantage on a die roll, leave it unmarked.`,
    },
    {
        title: "Jim Rockford",
        summary: t`Mysterious answering machine messages give tasks for XP`,
        description: t`At the beginning of each session, the Keeper will narrate an answering machine message you received. The message is always from the same unknown person, and they will ask you to do some particular task, seemingly unrelated to the mystery. If you complete the task in the same session it was assigned, mark XP. The messages and tasks will get increasingly strange and disturbing the more marks you have on The Crown of the Void. No two Mavens can ever have this move at the same time.`,
    },
    {
        title: "Scarecrow",
        summary: t`Receive mysterious Clues each session`,
        description: t`At the beginning of each session, a stranger presses something into your hand or leaves something in a place where you find it. The Keeper will tell you what it is. It functions as a Clue, but isn't attached to any particular mystery—you can use it in the present mystery or save it for the future.`,
    },
    {
        title: "Colt Seavers",
        summary: t`12+ on wild physical feats once per mystery`,
        description: t`Once per mystery, you can take a 12+ on a single roll related to a wild or daring physical feat.`,
    },
    {
        title: "Gordon Shumway",
        summary: t`Extraordinary cat companion for advantage that never gets marked`,
        description: t`You have a feline friend with whom you share a strong bond. This extraordinary kitty can do tricks and follow simple commands. Name your precocious puss and add them to your Cozy Little Place. When you use the cat to get an advantage on a roll, leave it unmarked.`,
    },
    {
        title: "Remington Steele",
        summary: t`Master of disguise with any needed ID`,
        description: t`You're very talented at passing yourself off as someone you are not. If there is a piece of identification or a disguise that would help you with your ruse, you have it. Say what it is and add it to your Cozy Little Place.`,
    },
]
