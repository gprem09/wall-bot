export const MESSAGES = {
  water: [
  ],
  break: [
    { text: 'sitting all day? very whimsical. take a break.', expression: 'smug', gesture: 'nod' },
  ],
  sitting: [
    { text: ({ min }) => `you’ve been sitting for ${min} min. get up.`, expression: 'smug', gesture: 'stretch' },
    { text: ({ min }) => `${min} min of vibecoding. go stretch your legs.`, expression: 'pouty', gesture: 'stretch' },
  ],
  fitness: [
  ],
  fun: [
    { text: 'are you actually working or just larping?', expression: 'annoyed', gesture: 'point' },
    { text: 'vibecoding again? love that for you.', expression: 'smug', gesture: 'nod' },
  ],
};

export const CHATTER = ['fitness', 'fun', 'fun'];

export const REACTIONS = {
  wave: [
    { text: 'oh, NOW you notice me.', expression: 'pouty' },
    { text: 'hi. finally.', expression: 'uwu' },
  ],
  greet: [
    { text: ({ min }) => `you were gone ${min} min. not that i counted.`, expression: 'smug' },
    { text: 'oh, you’re back. great. love that.', expression: 'deadpan' },
  ],
  leave: [
    { text: 'okay. bye i guess.', expression: 'crying' },
    { text: 'cool. i’ll just stay here. on the wall.', expression: 'crying' },
  ],
};
