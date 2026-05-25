import { t } from "@lingui/core/macro";

export const getEndOfSessionQuestions = () => [
  t`Did the Murder Mavens solve a mystery?`,
  t`Did you secretly undermine the authority of a local official?`,
  t`Did you share your wisdom with a young person?`,
  t`Did you share a memory of a late family member?`,
  t`Did you behave like a woman half your age?`,
  t`Did you dote on someone?`,
  t`Did you show someone that you've "still got it?"`,
];

export const getAdvancementOptions = () => [
  t`Increase an ability modifier by 1 (max +3).`,
  t`Increase an ability modifier by 1 (max +3).`,
  t`Choose an additional Maven move.`,
  t`Choose an additional Maven move.`,
  t`Unmark all the items in your Cozy Little Place.`,
];

export const getCrownsOfTheQueen = () => [
  t`A flashback of your fondest memory of your late partner.`,
  t`A flashback showing how you were an imperfect sister or daughter.`,
  t`A flashback showing how you were an imperfect mother.`,
  t`A flashback of your fondest memory with one of your children.`,
  t`A scene in the present day showing a private side of you very few get to see.`,
  t`A scene in the present day showing a burgeoning romance.`,
  t`A scene in the present day showing how you satisfy your physical desires.`,
];

export const getCrownOfTheVoid = () => [
  {
    title: t`A Shadow in the Garden.`,
    description: t`Hereafter, during cozy vignettes focused on you or Cozy Move scenes involving you, you must also narrate how dark entities subtly reveal themselves in the scene.`,
  },
  {
    title: t`The Chariot.`,
    description: t`Your Reason modifier is reduced by 1 and your Sensitivity modifier is increased by 1.`,
  },
  {
    title: t`The Pallid Mask.`,
    description: t`Hereafter, during any intimate conversation with another character, you must make a casual reference to death, dying, the afterlife, or the End of All Things—no matter the subject at-hand.`,
  },
  {
    title: t`The Pomegranate Kernel.`,
    description: t`You gain the condition 'Obsessed with the Void'. It can never be removed.`,
  },
  {
    title: t`The Void.`,
    description: t`Retire your character in a way that shows how they are lost to the Void.`,
  },
];

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
];

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
];

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
];

export const getClassicMavenMoves = () => [
  {
    title: "B.A. Baracus",
    summary: t`Avoid physical harm once per mystery`,
    description: t`Once per mystery, if you and/or any number of your fellow Mavens would suffer physical harm, you can describe how that physical harm is just narrowly avoided.`,
  },
  {
    title: "Frank Columbo",
    summary: t`Find an additional Clue when Meddling among the rich and famous once per mystery`,
    description: t`Something about you causes the elite of society to not take you too seriously. What is it? Once per mystery, when you do the Meddling Move in a place occupied by the rich and famous, you find an additional Clue, even on a miss.`,
  },
  {
    title: "Dale Cooper",
    summary: t`+1 Sensitivity and receive a strange dream Void Clue each session`,
    description: t`Add 1 to your Sensitivity (max 3). At the beginning of each session, the Keeper will give you a Void Clue in the form of a strange, unsettling dream you experience. No two Mavens can have this move at the same time.`,
  },
  {
    title: "Sonny Crockett",
    summary: t`Stylish Wardrobe for advantage on rolls that never gets marked`,
    description: t`You have a very stylish wardrobe--people say "Wow!" whenever they see you around town. Describe your Style in a little more detail and then add Stylish Wardrobe to your Cozy Little Place. When you use it to get an advantage on a die roll, leave it unmarked.`,
  },
  {
    title: "Frank Dowling",
    summary: t`Unmark every Crown of the Void box once`,
    description: t`You have a strong religious background. Describe it. When you use this move, describe how your faith is helping you resist the Void. Then, unmark every box on The Crown of the Void. You are still Obsessed with the Void if you unmark the Pomegranate Kernel. You may only use this move once.`,
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
];

export const getAlternateMavenMoves = () => [
  {
    title: "Auguste Dupin",
    summary: t`Ask the Keeper what's about to happen when entering a Location`,
    description: t`The first time you enter a Location, you can ask the Keeper, "What is about to happen?" They will answer truthfully, though not necessarily completely. If your Reason is 2 or higher, you can also ask, "Why is it about to happen?" The Keeper will answer truthfully, though not necessarily completely.`,
  },
  {
    title: "Encyclopedia Brown",
    summary: t`Introduce trivia as a Clue once per mystery`,
    description: t`Once per mystery, you can introduce a piece of real-world trivia about something in a scene. That trivia is a Clue.`,
  },
  {
    title: "Father Brown",
    summary: t`Narrate the killer's flashback to define a Clue once per mystery`,
    description: t`Once per mystery, you can narrate a flashback from the perspective of the unknown killer. Nothing in the flashback is necessarily true, but when you're done, ask the other Mavens to define a Clue based on what you narrated. The Clue cannot conclusively solve the mystery by itself.`,
  },
  {
    title: "Hercule Poirot",
    summary: t`+1 Reason (max 3)`,
    description: t`Increase your Reason by 1 (max 3).`,
  },
  {
    title: "Cadfael",
    summary: t`Herbalism Cozy Activity; brew helpful tinctures to add to your Cozy Little Place`,
    description: t`You are a highly skilled herbalist and have an additional Cozy Activity: Herbalism. If there is an herbal tincture or decoction that would be helpful in a situation, you can take the time to make it. If you do, add it to your Cozy Little Place.`,
  },
  {
    title: "Nancy Drew",
    summary: t`Secret ghost writer; both Gold Crown benefits while secret is kept`,
    description: t`You know that Robin Masterson hasn't written an Amanda Delacourt book in years and that her name is used as a pseudonym by dozens of secret ghost writers because you are one of those secret ghost writers. So long as you keep the secret, the Mavens always get both benefits of the Gold Crown Mysteries Move instead of having to choose. If you ever reveal the secret to anyone, you get a second use of the Gold Crown Mysteries Move during the mystery in which you reveal it, but take the Condition: Marked by the Robin Masterson Network, and you no longer have access to this move. No two Mavens can have this move at the same time.`,
  },
  {
    title: "Frank & Joe",
    summary: t`Avoid grave harm; wake up rattled in the perfect place once per mystery`,
    description: t`Once per mystery, when you would suffer grave physical harm, describe how you are knocked unconscious instead. Take the Condition: A Little Rattled. You always wake up in the perfect place to continue the investigation.`,
  },
  {
    title: "Sherlock Holmes",
    summary: t`Declare an absolute truth about a Suspect from their appearance`,
    description: t`The first time you encounter a Suspect, you can declare something about them based solely on their appearance. This information is absolutely true, but it is not a Clue, nor can it conclusively solve the mystery.`,
  },
  {
    title: "Robert Langdon",
    summary: t`Convert a Clue to a Void Clue once per mystery; reduces Dark Conspiracy thresholds`,
    description: t`Once per mystery, you can change a physical object that is a Clue into a Void Clue by describing secret markings, unusual patterns, or otherwise strange, occult details that are on it. If you have unlocked Layer Three of the Dark Conspiracy, tell the Keeper that the thresholds for each remaining layer are reduced by one Void Clue. No two Mavens can have this move at the same time. This move and the Clarice Starling move cannot be in the same game.`,
  },
  {
    title: "Philip Marlowe",
    summary: t`Narrate a true first-person arrival or encounter once per mystery when alone`,
    description: t`Once per mystery, so long as no other Maven is in the scene, you can do a first person narration of your arrival in a Location or your first encounter with a Suspect. Whatever you narrate is true, but it cannot conclusively solve the mystery. No two Mavens can have this move at the same time.`,
  },
  {
    title: "Jane Marple",
    summary: t`Enter any place freely during the day`,
    description: t`During the day, you can enter any place you wish, and move about freely once you're inside so long as you don't do anything actively hostile to any people who might be there.`,
  },
  {
    title: "Mma Precious Ramotswe",
    summary: t`Two extra Cozy Activities; trigger Cozy Move with non-Mavens; stumble on Clue or clear Condition during Cozy Moves`,
    description: t`You have two additional Cozy Activities; pick them from the list on your character sheet or write your own. Additionally, once per mystery, so long as you are engaged in one of your Cozy Activities, you can trigger the Cozy Move with a resident of Brindlewood Bay who is not a Maven. Finally, during the Cozy Move with another Maven, whichever Maven is doing their Cozy Activity can stumble on a Clue as normal OR clear another appropriate Condition.`,
  },
  {
    title: "Clarice Starling",
    summary: t`Name an imprisoned Suspect as Consultant; interview them once per mystery (behavior varies with Void marks)`,
    description: t`This move has no function until you solve a mystery and put a Suspect behind bars as a result. Thereafter, you can name an imprisoned Suspect your Consultant. Once per mystery, you can go to the prison the Consultant is being held in and ask them about that mystery. This triggers the Meddling Move as it would when questioning any other character, but the Consultant's answers and behavior are affected by your most recent mark on the Crown of the Void: No marks — the Consultant is mocking or insulting. A Shadow in the Garden — the Consultant claims to see malevolent spirits all around you. The Chariot — the Consultant reveals a Void Clue, even on a miss (but no extra effect on a 12+). The Pallid Mask — the Consultant also reveals the name of a character who will be killed if you don't do something to help them. The Pomegranate Kernel — the Consultant will also profess their love for you; reciprocate to clear Obsessed with the Void and lose this move, or reject to take Condition: Marked by [Consultant] and lose this move. No two Mavens can have this move at the same time. This move and the Robert Langdon move cannot be in the same game.`,
  },
  {
    title: "Sam Spade",
    summary: t`Enter any place freely at night`,
    description: t`Something about you makes you seem like you have a bit of an edge. What is it? During the night, you can enter any place you wish, and move about freely once you're inside so long as you don't do anything actively hostile to any people who might be there.`,
  },
  {
    title: "Tintin",
    summary: t`Canine companion that gains the power of speech when Layer 5 is unlocked`,
    description: t`You have a canine companion with whom you share a strong bond. This incredible pup can understand what you say with near-perfect comprehension. Name them and add them to your Cozy Little Place. They gain the power of speech once Layer 5 of the Dark Conspiracy is unlocked, but only you can understand them. No two Mavens can have this move at the same time.`,
  },
  {
    title: "V.I. Warshawski",
    summary: t`+1 Vitality (max 3)`,
    description: t`Increase your Vitality by 1 (max 3).`,
  },
  {
    title: "Nero Wolfe",
    summary: t`Lavish Cozy Little Place: Gourmet Pantry, Orchidarium, Full Bar, Private Elevator, and House Boy`,
    description: t`Your Cozy Little Place is anything but. Add the following to it: Gourmet Pantry, Orchidarium, Full Bar, Private Elevator, House Boy (name him). No two Mavens can have this move at the same time.`,
  },
  {
    title: "Phoenix Wright",
    summary: t`Uncover a hidden secret from object Clues`,
    description: t`Whenever you find a Clue that is an object, you can physically manipulate the object to uncover a further secret about it—a hidden detail, a secret compartment, a scrawled message, etc. This extra detail is added to the Clue; it cannot cause the Clue to conclusively solve the mystery by itself.`,
  },
];
