// Master timeline (seconds). Read by index.html (scenes) and make_audio.py (voice + sfx mix).
// Keep it valid JSON after the "=" so Python can parse it.
window.TL = {
 "duration": 44.0,
 "vo": {
  "v1": 0.7, "v2a": 8.7, "v2b": 10.2, "v2c": 11.75, "v2d": 13.35,
  "v3": 15.4, "v4": 21.25, "v5a": 26.5, "v5fr": 28.75, "v5b": 29.75,
  "v6": 35.7, "v7": 40.8, "v7fr": 41.75
 },
 "scene": {
  "wake": 2.4, "nervous": 5.4, "leap": 7.1, "land": 8.9,
  "check1": 10.95, "check2": 12.6, "check3": 13.8, "bounce": 14.3, "hopItin": 14.75,
  "itinScroll": 15.6, "hopFiles": 20.55, "doc1": 21.35, "doc2": 22.15, "doc3": 22.95, "salute": 24.3,
  "hopLearn": 25.75, "answer": 28.55, "verse": 30.1, "culture": 31.3, "spire": 32.2, "victory": 33.55,
  "takeoff": 34.9, "flock": 35.6, "landEnd": 40.3, "logo": 40.6, "wave": 41.7
 },
 "sfx": [
  ["pop", 2.4], ["boing", 5.4], ["whoosh", 7.1], ["tap", 8.9],
  ["ding", 10.95], ["ding", 12.6], ["ding", 13.8], ["hop", 14.75],
  ["hop", 20.55], ["whoosh", 21.35], ["whoosh", 22.15], ["whoosh", 22.95],
  ["hop", 25.75], ["ding", 28.55], ["chime", 33.55], ["whoosh", 34.9], ["tap", 40.3], ["chime", 40.6]
 ]
};
