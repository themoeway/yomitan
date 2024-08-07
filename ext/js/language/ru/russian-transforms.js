// All grammatical information is derived from Terence Wade's Comprehensive Russian Grammar

//
// VERBAL SUFFIXES
//

// PAST TENSE
const pastSuffixInflections = [
    suffixInflection('л', 'ть', ['v1a'], ['v']), // мужский род
    suffixInflection('ло', 'ть', ['v1a'], ['v']), // средний род
    suffixInflection('ла', 'ть', ['v1a'], ['v']), // женский род
    suffixInflection('ли', 'ть', ['v1a'], ['v']), // многочисленный

    suffixInflection('лся', 'ться', ['v1b'], ['v']), // мужский род
    suffixInflection('лось', 'ться', ['v1b'], ['v']), // средний род
    suffixInflection('лась', 'ться', ['v1b'], ['v']), // женский род
    suffixInflection('лись', 'ться', ['v1b'], ['v']) // многочисленный
];

// PRESENT-FUTURE TENSE
// (1) The first-conjugation ending (-е-)
const presentSuffixInflections1 = [
    suffixInflection('ю', 'ть', ['v1a'], ['v']), // первое лицо единственное число
    suffixInflection('ешь', 'ть', ['v1a'], ['v']), // второе лицо единственное число
    suffixInflection('ет', 'ть', ['v1a'], ['v']), // третье лицо единственное число
    suffixInflection('ем', 'ть', ['v1a'], ['v']), // первое лицо множественное число
    suffixInflection('ете', 'ть', ['v1a'], ['v']), // второе лицо множественное число
    suffixInflection('ют', 'ть', ['v1a'], ['v']), // третье лицо множественное число

    suffixInflection('юсь', 'ться', ['v1b'], ['v']), // возвратный залог
    suffixInflection('ешься', 'ться', ['v1b'], ['v']), 
    suffixInflection('ется', 'ться', ['v1b'], ['v']), 
    suffixInflection('емся', 'ться', ['v1b'], ['v']), 
    suffixInflection('етесь', 'ться', ['v1b'], ['v']), 
    suffixInflection('ются', 'ться', ['v1b'], ['v'])    
];

// (1A) Vowel stem, special cases
// (1Aa) verbs in ‐авáть: давать, compounds of it, verbs in -знавать, -ставать
const presentSuffixInflections1Aa = [
    suffixInflection('ю', 'вать', ['v1a'], ['v']),
    suffixInflection('ёшь', 'вать', ['v1a'], ['v']),
    suffixInflection('ёт', 'вать', ['v1a'], ['v']),
    suffixInflection('ём', 'вать', ['v1a'], ['v']),
    suffixInflection('ёте', 'вать', ['v1a'], ['v']),
    suffixInflection('ют', 'вать', ['v1a'], ['v']),

    suffixInflection('юсь', 'ваться', ['v1a'], ['v']),
    suffixInflection('ёшься', 'ваться', ['v1a'], ['v']),
    suffixInflection('ётся', 'ваться', ['v1a'], ['v']),
    suffixInflection('ёмся', 'ваться', ['v1a'], ['v']),
    suffixInflection('ётесь', 'ваться', ['v1a'], ['v']),
    suffixInflection('ются', 'ваться', ['v1a'], ['v'])
];

// (1Ab) verbs in ‐овать with more than two syllables: голосовать, требовать
// except здороваться (1)
const presentSuffixInflections1Ab = [
    suffixInflection('ую', 'овать', ['v1a'], ['v']),
    suffixInflection('уешь', 'овать', ['v1a'], ['v']),
    suffixInflection('ует', 'овать', ['v1a'], ['v']),
    suffixInflection('уем', 'овать', ['v1a'], ['v']),
    suffixInflection('уете', 'овать', ['v1a'], ['v']),
    suffixInflection('уют', 'овать', ['v1a'], ['v']),

    suffixInflection('уюсь', 'оваться', ['v1a'], ['v']),
    suffixInflection('уешься', 'оваться', ['v1a'], ['v']),
    suffixInflection('уется', 'оваться', ['v1a'], ['v']),
    suffixInflection('уемся', 'оваться', ['v1a'], ['v']),
    suffixInflection('уетесь', 'оваться', ['v1a'], ['v']),
    suffixInflection('уются', 'оваться', ['v1a'], ['v'])
];

// (1Ac) verbs in -евать: плевать, горевать
// except застревать, затевать, зевать, подозревать, преодолевать, secondary imperfectives in -девать, -певать, -спевать (1)
const presentSuffixInflections1Ac = [
    suffixInflection('юю', 'евать', ['v1a'], ['v']),
    suffixInflection('юёшь', 'евать', ['v1a'], ['v']),
    suffixInflection('юёт', 'евать', ['v1a'], ['v']),
    suffixInflection('юём', 'евать', ['v1a'], ['v']),
    suffixInflection('юёте', 'евать', ['v1a'], ['v']),
    suffixInflection('юют', 'евать', ['v1a'], ['v']),

    suffixInflection('ююсь', 'еваться', ['v1a'], ['v']),
    suffixInflection('юёшься', 'еваться', ['v1a'], ['v']),
    suffixInflection('юётся', 'еваться', ['v1a'], ['v']),
    suffixInflection('юёмся', 'еваться', ['v1a'], ['v']),
    suffixInflection('юётесь', 'еваться', ['v1a'], ['v']),
    suffixInflection('юются', 'еваться', ['v1a'], ['v'])
];

// (1Ad) петь
const presentSuffixInflections1Ad = [
    suffixInflection('ою', 'еть', ['v1a'], ['v']),
    suffixInflection('оёшь', 'еть', ['v1a'], ['v']),
    suffixInflection('оёт', 'еть', ['v1a'], ['v']),
    suffixInflection('оём', 'еть', ['v1a'], ['v']),
    suffixInflection('оёте', 'еть', ['v1a'], ['v']),
    suffixInflection('оют', 'еть', ['v1a'], ['v']),

    suffixInflection('оюсь', 'еться', ['v1a'], ['v']),
    suffixInflection('оёшься', 'еться', ['v1a'], ['v']),
    suffixInflection('оётся', 'еться', ['v1a'], ['v']),
    suffixInflection('оёмся', 'еться', ['v1a'], ['v']),
    suffixInflection('оётесь', 'еться', ['v1a'], ['v']),
    suffixInflection('оются', 'еться', ['v1a'], ['v'])
];

// (1Ae) бить, вить, лить, пить, шить
const presentSuffixInflections1Ae = [
    suffixInflection('ью', 'ить', ['v1a'], ['v']),
    suffixInflection('ьёшь', 'ить', ['v1a'], ['v']),
    suffixInflection('ьёт', 'ить', ['v1a'], ['v']),
    suffixInflection('ьём', 'ить', ['v1a'], ['v']),
    suffixInflection('ьёте', 'ить', ['v1a'], ['v']),
    suffixInflection('ьют', 'ить', ['v1a'], ['v']),

    suffixInflection('ьюсь', 'иться', ['v1a'], ['v']),
    suffixInflection('ьёшься', 'иться', ['v1a'], ['v']),
    suffixInflection('ьётся', 'иться', ['v1a'], ['v']),
    suffixInflection('ьёмся', 'иться', ['v1a'], ['v']),
    suffixInflection('ьётесь', 'иться', ['v1a'], ['v']),
    suffixInflection('ьются', 'иться', ['v1a'], ['v'])
];

// (1Af) брить
const presentSuffixInflections1Af = [
    suffixInflection('ею', 'ить', ['v1a'], ['v']),
    suffixInflection('еёшь', 'ить', ['v1a'], ['v']),
    suffixInflection('еёт', 'ить', ['v1a'], ['v']),
    suffixInflection('еём', 'ить', ['v1a'], ['v']),
    suffixInflection('еёте', 'ить', ['v1a'], ['v']),
    suffixInflection('еют', 'ить', ['v1a'], ['v']),

    suffixInflection('еюсь', 'иться', ['v1a'], ['v']),
    suffixInflection('еёшься', 'иться', ['v1a'], ['v']),
    suffixInflection('еётся', 'иться', ['v1a'], ['v']),
    suffixInflection('еёмся', 'иться', ['v1a'], ['v']),
    suffixInflection('еётесь', 'иться', ['v1a'], ['v']),
    suffixInflection('еются', 'иться', ['v1a'], ['v'])
];

// (1Ag) мыть, выть, крыть, ныть, рыть
const presentSuffixInflections1Ag = [
    suffixInflection('ою', 'ыть', ['v1a'], ['v']),
    suffixInflection('оёшь', 'ыть', ['v1a'], ['v']),
    suffixInflection('оёт', 'ыть', ['v1a'], ['v']),
    suffixInflection('оём', 'ыть', ['v1a'], ['v']),
    suffixInflection('оёте', 'ыть', ['v1a'], ['v']),
    suffixInflection('оют', 'ыть', ['v1a'], ['v']),

    suffixInflection('оюсь', 'ыться', ['v1a'], ['v']),
    suffixInflection('оёшься', 'ыться', ['v1a'], ['v']),
    suffixInflection('оётся', 'ыться', ['v1a'], ['v']),
    suffixInflection('оёмся', 'ыться', ['v1a'], ['v']),
    suffixInflection('оётесь', 'ыться', ['v1a'], ['v']),
    suffixInflection('оются', 'ыться', ['v1a'], ['v'])
];

// (1B) Consonant stem, special cases
// (1BA) Present-future and infinitive stems coincide:
// (1BAa) verbs in -ать
// ждать, врать, жаждать, жрать, орать, рвать, ржать, сосать, стонать, ткать
const presentSuffixInflections1BAa = [
    suffixInflection('у', 'ать', ['v1a'], ['v']),
    suffixInflection('ёшь', 'ать', ['v1a'], ['v']),
    suffixInflection('ёт', 'ать', ['v1a'], ['v']),
    suffixInflection('ём', 'ать', ['v1a'], ['v']),
    suffixInflection('ёте', 'ать', ['v1a'], ['v']),
    suffixInflection('ут', 'ать', ['v1a'], ['v']),

    suffixInflection('усь', 'аться', ['v1a'], ['v']),
    suffixInflection('ёшься', 'аться', ['v1a'], ['v']),
    suffixInflection('ётся', 'аться', ['v1a'], ['v']),
    suffixInflection('ёмся', 'аться', ['v1a'], ['v']),
    suffixInflection('ётесь', 'аться', ['v1a'], ['v']),
    suffixInflection('утся', 'аться', ['v1a'], ['v'])   
];

// (1BAb) The same but with a velar/sibilant mutation
// лгать
const presentSuffixInflections1Bab = [
    suffixInflection('у', 'ать', ['v1a'], ['v']),
    suffixInflection('жёшь', 'гать', ['v1a'], ['v']),
    suffixInflection('жёт', 'гать', ['v1a'], ['v']),
    suffixInflection('жём', 'гать', ['v1a'], ['v']),
    suffixInflection('жёте', 'гать', ['v1a'], ['v']),
    suffixInflection('ут', 'ать', ['v1a'], ['v']),

    suffixInflection('усь', 'аться', ['v1a'], ['v']),
    suffixInflection('жёшься', 'гаться', ['v1a'], ['v']),
    suffixInflection('жётся', 'гаться', ['v1a'], ['v']),
    suffixInflection('жёмся', 'гаться', ['v1a'], ['v']),
    suffixInflection('жётесь', 'гаться', ['v1a'], ['v']),
    suffixInflection('утся', 'аться', ['v1a'], ['v'])  
];

// (1BAc) verbs in -нуть
// гнуть
const presentSuffixInflections1BAc = [
    suffixInflection('у', 'нуть', ['v1a'], ['v']),
    suffixInflection('ёшь', 'нуть', ['v1a'], ['v']),
    suffixInflection('ёт', 'нуть', ['v1a'], ['v']),
    suffixInflection('ём', 'нуть', ['v1a'], ['v']),
    suffixInflection('ёте', 'нуть', ['v1a'], ['v']),
    suffixInflection('ут', 'нуть', ['v1a'], ['v']),

    suffixInflection('усь', 'нуться', ['v1a'], ['v']),
    suffixInflection('ёшься', 'нуться', ['v1a'], ['v']),
    suffixInflection('ётся', 'нуться', ['v1a'], ['v']),
    suffixInflection('ёмся', 'нуться', ['v1a'], ['v']),
    suffixInflection('ётесь', 'нуться', ['v1a'], ['v']),
    suffixInflection('утся', 'нуться', ['v1a'], ['v'])   
];

// (1BAd) verbs in -оть
// колоть, бороться, полоть, пороть
const presentSuffixInflections1BAd = [
    suffixInflection('ю', 'оть', ['v1a'], ['v']),
    suffixInflection('ешь', 'оть', ['v1a'], ['v']),
    suffixInflection('ет', 'оть', ['v1a'], ['v']),
    suffixInflection('ем', 'оть', ['v1a'], ['v']),
    suffixInflection('ете', 'оть', ['v1a'], ['v']),
    suffixInflection('ют', 'оть', ['v1a'], ['v']),

    suffixInflection('юсь', 'оться', ['v1b'], ['v']),
    suffixInflection('ешься', 'оться', ['v1b'], ['v']), 
    suffixInflection('ется', 'оться', ['v1b'], ['v']), 
    suffixInflection('емся', 'оться', ['v1b'], ['v']), 
    suffixInflection('етесь', 'оться', ['v1b'], ['v']), 
    suffixInflection('ются', 'оться', ['v1b'], ['v'])    
];

// (1BAe) молоть
const presentSuffixInflections1BAe = [
    suffixInflection('елю', 'олоть', ['v1a'], ['v']),
    suffixInflection('елешь', 'олоть', ['v1a'], ['v']),
    suffixInflection('елет', 'олоть', ['v1a'], ['v']),
    suffixInflection('елем', 'олоть', ['v1a'], ['v']),
    suffixInflection('елете', 'олоть', ['v1a'], ['v']),
    suffixInflection('елют', 'олоть', ['v1a'], ['v']),

    suffixInflection('елюсь', 'олоться', ['v1b'], ['v']),
    suffixInflection('елешься', 'олоться', ['v1b'], ['v']), 
    suffixInflection('елется', 'олоться', ['v1b'], ['v']), 
    suffixInflection('елемся', 'олоться', ['v1b'], ['v']), 
    suffixInflection('елетесь', 'олоться', ['v1b'], ['v']), 
    suffixInflection('елются', 'олоться', ['v1b'], ['v'])    
];


// (1BB) Present-future and infinitive stems differ:
// (1BBA) mobile е
// (1BBAa) mobile е with р
// брать, драть
const presentSuffixInflections1BBAa = [
    suffixInflection('еру', 'рать', ['v1a'], ['v']),
    suffixInflection('ерёшь', 'рать', ['v1a'], ['v']),
    suffixInflection('ерёт', 'рать', ['v1a'], ['v']),
    suffixInflection('ерём', 'рать', ['v1a'], ['v']),
    suffixInflection('ерёте', 'рать', ['v1a'], ['v']),
    suffixInflection('ерут', 'рать', ['v1a'], ['v']),

    suffixInflection('ерусь', 'раться', ['v1a'], ['v']),
    suffixInflection('ерёшься', 'раться', ['v1a'], ['v']),
    suffixInflection('ерётся', 'раться', ['v1a'], ['v']),
    suffixInflection('ерёмся', 'раться', ['v1a'], ['v']),
    suffixInflection('ерётесь', 'раться', ['v1a'], ['v']),
    suffixInflection('ерутся', 'раться', ['v1a'], ['v'])   
];

// (1BBAb) mobile е with л
// стлать
const presentSuffixInflections1BBAb = [
    suffixInflection('елю', 'лать', ['v1a'], ['v']),
    suffixInflection('елешь', 'лать', ['v1a'], ['v']),
    suffixInflection('елет', 'лать', ['v1a'], ['v']),
    suffixInflection('елем', 'лать', ['v1a'], ['v']),
    suffixInflection('елете', 'лать', ['v1a'], ['v']),
    suffixInflection('елют', 'лать', ['v1a'], ['v']),

    suffixInflection('елюсь', 'латься', ['v1a'], ['v']),
    suffixInflection('елешься', 'латься', ['v1a'], ['v']),
    suffixInflection('елется', 'латься', ['v1a'], ['v']),
    suffixInflection('елемся', 'латься', ['v1a'], ['v']),
    suffixInflection('елетесь', 'латься', ['v1a'], ['v']),
    suffixInflection('елются', 'латься', ['v1a'], ['v'])   
];

// (1BBb) mobile о
// звать
const presentSuffixInflections1BBb = [
    suffixInflection('ову', 'вать', ['v1a'], ['v']),
    suffixInflection('овёшь', 'вать', ['v1a'], ['v']),
    suffixInflection('овёт', 'вать', ['v1a'], ['v']),
    suffixInflection('овём', 'вать', ['v1a'], ['v']),
    suffixInflection('овёт', 'вать', ['v1a'], ['v']),
    suffixInflection('овут', 'вать', ['v1a'], ['v']),

    suffixInflection('овусь', 'ваться', ['v1a'], ['v']),
    suffixInflection('овёшься', 'ваться', ['v1a'], ['v']),
    suffixInflection('овётся', 'ваться', ['v1a'], ['v']),
    suffixInflection('овёмся', 'ваться', ['v1a'], ['v']),
    suffixInflection('овётесь', 'ваться', ['v1a'], ['v']),
    suffixInflection('овутся', 'ваться', ['v1a'], ['v'])   
];

// (1BBC) mobile в
// (1BBCa) жить
const presentSuffixInflections1BBCa = [
    suffixInflection('ву', 'ить', ['v1a'], ['v']),
    suffixInflection('вёшь', 'ить', ['v1a'], ['v']),
    suffixInflection('вёт', 'ить', ['v1a'], ['v']),
    suffixInflection('вём', 'ить', ['v1a'], ['v']),
    suffixInflection('вёте', 'ить', ['v1a'], ['v']),
    suffixInflection('вут', 'ить', ['v1a'], ['v']),

    suffixInflection('вусь', 'иться', ['v1a'], ['v']),
    suffixInflection('вёшься', 'иться', ['v1a'], ['v']),
    suffixInflection('вётся', 'иться', ['v1a'], ['v']),
    suffixInflection('вёмся', 'иться', ['v1a'], ['v']),
    suffixInflection('вётесь', 'иться', ['v1a'], ['v']),
    suffixInflection('вутся', 'иться', ['v1a'], ['v'])   
];

// (1BBCb) плыть, слыть
const presentSuffixInflections1BBCb = [
    suffixInflection('ву', 'ть', ['v1a'], ['v']),
    suffixInflection('вёшь', 'ть', ['v1a'], ['v']),
    suffixInflection('вёт', 'ть', ['v1a'], ['v']),
    suffixInflection('вём', 'ть', ['v1a'], ['v']),
    suffixInflection('вёте', 'ть', ['v1a'], ['v']),
    suffixInflection('вут', 'ть', ['v1a'], ['v']),

    suffixInflection('вусь', 'ться', ['v1a'], ['v']),
    suffixInflection('вёшься', 'ться', ['v1a'], ['v']),
    suffixInflection('вётся', 'ться', ['v1a'], ['v']),
    suffixInflection('вёмся', 'ться', ['v1a'], ['v']),
    suffixInflection('вётесь', 'ться', ['v1a'], ['v']),
    suffixInflection('вутся', 'ться', ['v1a'], ['v'])   
];

// (1BBD) mobile д
// (1BBDa) быть
const presentSuffixInflections1BBDa = [
    suffixInflection('уду', 'ыть', ['v1a'], ['v']),
    suffixInflection('удешь', 'ыть', ['v1a'], ['v']),
    suffixInflection('удет', 'ыть', ['v1a'], ['v']),
    suffixInflection('удем', 'ыть', ['v1a'], ['v']),
    suffixInflection('удете', 'ыть', ['v1a'], ['v']),
    suffixInflection('удут', 'ыть', ['v1a'], ['v']),

    suffixInflection('удусь', 'ыться', ['v1a'], ['v']),
    suffixInflection('удешься', 'ыться', ['v1a'], ['v']),
    suffixInflection('удется', 'ыться', ['v1a'], ['v']),
    suffixInflection('удемся', 'ыться', ['v1a'], ['v']),
    suffixInflection('удетесь', 'ыться', ['v1a'], ['v']),
    suffixInflection('удутся', 'ыться', ['v1a'], ['v'])   
];

// (1BBDb) ехать
const presentSuffixInflections1BBDb = [
    suffixInflection('ду', 'хать', ['v1a'], ['v']),
    suffixInflection('дешь', 'хать', ['v1a'], ['v']),
    suffixInflection('дет', 'хать', ['v1a'], ['v']),
    suffixInflection('дем', 'хать', ['v1a'], ['v']),
    suffixInflection('дете', 'хать', ['v1a'], ['v']),
    suffixInflection('дут', 'хать', ['v1a'], ['v']),

    suffixInflection('дусь', 'хаться', ['v1a'], ['v']),
    suffixInflection('дешься', 'хаться', ['v1a'], ['v']),
    suffixInflection('дется', 'хаться', ['v1a'], ['v']),
    suffixInflection('демся', 'хаться', ['v1a'], ['v']),
    suffixInflection('детесь', 'хаться', ['v1a'], ['v']),
    suffixInflection('дутся', 'хаться', ['v1a'], ['v'])   
];

// (1BBE) mobile м
// (1BBEa) взять
const presentSuffixInflections1BBEa = [
    suffixInflection('озьму', 'зять', ['v1a'], ['v']),
    suffixInflection('озьмёшь', 'зять', ['v1a'], ['v']),
    suffixInflection('озьмёт', 'зять', ['v1a'], ['v']),
    suffixInflection('озьмём', 'зять', ['v1a'], ['v']),
    suffixInflection('озьмёте', 'зять', ['v1a'], ['v']),
    suffixInflection('озьмут', 'зять', ['v1a'], ['v']),

    suffixInflection('озьмусь', 'зяться', ['v1a'], ['v']),
    suffixInflection('озьмёшься', 'зяться', ['v1a'], ['v']),
    suffixInflection('озьмётся', 'зяться', ['v1a'], ['v']),
    suffixInflection('озьмёмся', 'зяться', ['v1a'], ['v']),
    suffixInflection('озьмётесь', 'зяться', ['v1a'], ['v']),
    suffixInflection('озьмутся', 'зяться', ['v1a'], ['v'])   
];

// (1BBEb) снять, compounds in -(consonant)нять
const presentSuffixInflections1BBEb = [
    suffixInflection('иму', 'ять', ['v1a'], ['v']),
    suffixInflection('имешь', 'ять', ['v1a'], ['v']),
    suffixInflection('имет', 'ять', ['v1a'], ['v']),
    suffixInflection('имем', 'ять', ['v1a'], ['v']),
    suffixInflection('имете', 'ять', ['v1a'], ['v']),
    suffixInflection('имут', 'ять', ['v1a'], ['v']),

    suffixInflection('имусь', 'яться', ['v1a'], ['v']),
    suffixInflection('имешься', 'яться', ['v1a'], ['v']),
    suffixInflection('имется', 'яться', ['v1a'], ['v']),
    suffixInflection('имемся', 'яться', ['v1a'], ['v']),
    suffixInflection('иметесь', 'яться', ['v1a'], ['v']),
    suffixInflection('имутся', 'яться', ['v1a'], ['v'])   
];

// (1BBEc) понять, compounds in -(vowel)нять
const presentSuffixInflections1BBEc = [
    suffixInflection('йму', 'нять', ['v1a'], ['v']),
    suffixInflection('ймёшь', 'нять', ['v1a'], ['v']),
    suffixInflection('ймёт', 'нять', ['v1a'], ['v']),
    suffixInflection('ймём', 'нять', ['v1a'], ['v']),
    suffixInflection('ймёте', 'нять', ['v1a'], ['v']),
    suffixInflection('ймут', 'нять', ['v1a'], ['v']),

    suffixInflection('ймусь', 'няться', ['v1a'], ['v']),
    suffixInflection('ймёшься', 'няться', ['v1a'], ['v']),
    suffixInflection('ймётся', 'няться', ['v1a'], ['v']),
    suffixInflection('ймёмся', 'няться', ['v1a'], ['v']),
    suffixInflection('ймётесь', 'няться', ['v1a'], ['v']),
    suffixInflection('ймутся', 'няться', ['v1a'], ['v'])   
];

// (1BBEd) жать
const presentSuffixInflections1BBEd = [
    suffixInflection('му', 'ать', ['v1a'], ['v']),
    suffixInflection('мёшь', 'ать', ['v1a'], ['v']),
    suffixInflection('мёт', 'ать', ['v1a'], ['v']),
    suffixInflection('мём', 'ать', ['v1a'], ['v']),
    suffixInflection('мёте', 'ать', ['v1a'], ['v']),
    suffixInflection('мут', 'ать', ['v1a'], ['v']),

    suffixInflection('мусь', 'аться', ['v1a'], ['v']),
    suffixInflection('мёшься', 'аться', ['v1a'], ['v']),
    suffixInflection('мётся', 'аться', ['v1a'], ['v']),
    suffixInflection('мёмся', 'аться', ['v1a'], ['v']),
    suffixInflection('мётесь', 'аться', ['v1a'], ['v']),
    suffixInflection('мутся', 'аться', ['v1a'], ['v'])   
];


// (1BBF) mobile н
// (1BBFa) жать 2, начать
const presentSuffixInflections1BBFa = [
    suffixInflection('ну', 'ать', ['v1a'], ['v']),
    suffixInflection('нёшь', 'ать', ['v1a'], ['v']),
    suffixInflection('нёт', 'ать', ['v1a'], ['v']),
    suffixInflection('нём', 'ать', ['v1a'], ['v']),
    suffixInflection('нёте', 'ать', ['v1a'], ['v']),
    suffixInflection('нут', 'ать', ['v1a'], ['v']),

    suffixInflection('нусь', 'аться', ['v1a'], ['v']),
    suffixInflection('нёшься', 'аться', ['v1a'], ['v']),
    suffixInflection('нётся', 'аться', ['v1a'], ['v']),
    suffixInflection('нёмся', 'аться', ['v1a'], ['v']),
    suffixInflection('нётесь', 'аться', ['v1a'], ['v']),
    suffixInflection('нутся', 'аться', ['v1a'], ['v'])   
    ];

// (1BBFb) деть, застрять, стать, стыть
const presentSuffixInflections1BBFb = [
    suffixInflection('ну', 'ть', ['v1a'], ['v']),
    suffixInflection('нешь', 'ть', ['v1a'], ['v']),
    suffixInflection('нет', 'ть', ['v1a'], ['v']),
    suffixInflection('нем', 'ть', ['v1a'], ['v']),
    suffixInflection('нете', 'ть', ['v1a'], ['v']),
    suffixInflection('нут', 'ть', ['v1a'], ['v']),

    suffixInflection('нусь', 'ться', ['v1a'], ['v']),
    suffixInflection('нешься', 'ться', ['v1a'], ['v']),
    suffixInflection('нется', 'ться', ['v1a'], ['v']),
    suffixInflection('немся', 'ться', ['v1a'], ['v']),
    suffixInflection('нетесь', 'ться', ['v1a'], ['v']),
    suffixInflection('нутся', 'ться', ['v1a'], ['v'])   
];

// (1BBFc) мять, распять
const presentSuffixInflections1BBFc = [
    suffixInflection('ну', 'ять', ['v1a'], ['v']),
    suffixInflection('нёшь', 'ять', ['v1a'], ['v']),
    suffixInflection('нёт', 'ять', ['v1a'], ['v']),
    suffixInflection('нём', 'ять', ['v1a'], ['v']),
    suffixInflection('нёте', 'ять', ['v1a'], ['v']),
    suffixInflection('нут', 'ять', ['v1a'], ['v']),

    suffixInflection('нусь', 'яться', ['v1a'], ['v']),
    suffixInflection('нёшься', 'яться', ['v1a'], ['v']),
    suffixInflection('нётся', 'яться', ['v1a'], ['v']),
    suffixInflection('нёмся', 'яться', ['v1a'], ['v']),
    suffixInflection('нётесь', 'яться', ['v1a'], ['v']),
    suffixInflection('нутся', 'яться', ['v1a'], ['v'])   
    ];


// (1BBg) loss of mobile vowel (verbs in -ереть)
// тереть, compounds in -мереть, -переть
const presentSuffixInflections1BBg = [
    suffixInflection('ру', 'ереть', ['v1a'], ['v']),
    suffixInflection('рёшь', 'ереть', ['v1a'], ['v']),
    suffixInflection('рёт', 'ереть', ['v1a'], ['v']),
    suffixInflection('рём', 'ереть', ['v1a'], ['v']),
    suffixInflection('рёте', 'ереть', ['v1a'], ['v']),
    suffixInflection('рут', 'ереть', ['v1a'], ['v']),

    suffixInflection('русь', 'ереться', ['v1a'], ['v']),
    suffixInflection('рёшься', 'ереться', ['v1a'], ['v']),
    suffixInflection('рётся', 'ереться', ['v1a'], ['v']),
    suffixInflection('рёмся', 'ереться', ['v1a'], ['v']),
    suffixInflection('рётесь', 'ереться', ['v1a'], ['v']),
    suffixInflection('рутся', 'ереться', ['v1a'], ['v'])   
    ];

// (1BBh) others; Wade additionally mentions реветь and compounds of -шибить, which are regular for our purposes
// слать and its compounds
const presentSuffixInflections1BBh = [
    suffixInflection('шлю', 'слать', ['v1a'], ['v']),
    suffixInflection('шлёшь', 'слать', ['v1a'], ['v']),
    suffixInflection('шлёт', 'слать', ['v1a'], ['v']),
    suffixInflection('шлём', 'слать', ['v1a'], ['v']),
    suffixInflection('шлёте', 'слать', ['v1a'], ['v']),
    suffixInflection('шлют', 'слать', ['v1a'], ['v']),

    suffixInflection('шлюсь', 'слаться', ['v1a'], ['v']),
    suffixInflection('шлёшься', 'слаться', ['v1a'], ['v']),
    suffixInflection('шлётся', 'слаться', ['v1a'], ['v']),
    suffixInflection('шлёмся', 'слаться', ['v1a'], ['v']),
    suffixInflection('шлётесь', 'слаться', ['v1a'], ['v']),
    suffixInflection('шлются', 'слаться', ['v1a'], ['v'])
];

// (1C) Consonant stems II: verbs in -ать with consistent consonant mutation
// All applicable verbs are given in the book, p248/286
// (1Ca) д - ж
// глодать
const presentSuffixInflections1Ca = [
    suffixInflection('жу', 'дать', ['v1a'], ['v']),
    suffixInflection('жешь', 'дать', ['v1a'], ['v']),
    suffixInflection('жет', 'дать', ['v1a'], ['v']),
    suffixInflection('жем', 'дать', ['v1a'], ['v']),
    suffixInflection('жете', 'дать', ['v1a'], ['v']),
    suffixInflection('жут', 'дать', ['v1a'], ['v']),

    suffixInflection('жусь', 'даться', ['v1a'], ['v']),
    suffixInflection('жешься', 'даться', ['v1a'], ['v']),
    suffixInflection('жется', 'даться', ['v1a'], ['v']),
    suffixInflection('жемся', 'даться', ['v1a'], ['v']),
    suffixInflection('жетесь', 'даться', ['v1a'], ['v']),
    suffixInflection('жутся', 'даться', ['v1a'], ['v'])
];

// (1Cb) т - ч
// шептать, бормотать
const presentSuffixInflections1Cb = [
    suffixInflection('чу', 'тать', ['v1a'], ['v']),
    suffixInflection('чешь', 'тать', ['v1a'], ['v']),
    suffixInflection('чет', 'тать', ['v1a'], ['v']),
    suffixInflection('чем', 'тать', ['v1a'], ['v']),
    suffixInflection('чете', 'тать', ['v1a'], ['v']),
    suffixInflection('чут', 'тать', ['v1a'], ['v']),

    suffixInflection('чусь', 'таться', ['v1a'], ['v']),
    suffixInflection('чешься', 'таться', ['v1a'], ['v']),
    suffixInflection('чется', 'таться', ['v1a'], ['v']),
    suffixInflection('чемся', 'таться', ['v1a'], ['v']),
    suffixInflection('четесь', 'таться', ['v1a'], ['v']),
    suffixInflection('чутся', 'таться', ['v1a'], ['v'])
];

// (1Cc) т - щ
// клеветать
const presentSuffixInflections1Cc = [
    suffixInflection('щу', 'тать', ['v1a'], ['v']),
    suffixInflection('щешь', 'тать', ['v1a'], ['v']),
    suffixInflection('щет', 'тать', ['v1a'], ['v']),
    suffixInflection('щем', 'тать', ['v1a'], ['v']),
    suffixInflection('щете', 'тать', ['v1a'], ['v']),
    suffixInflection('щут', 'тать', ['v1a'], ['v']),

    suffixInflection('щусь', 'таться', ['v1a'], ['v']),
    suffixInflection('щешься', 'таться', ['v1a'], ['v']),
    suffixInflection('щется', 'таться', ['v1a'], ['v']),
    suffixInflection('щемся', 'таться', ['v1a'], ['v']),
    suffixInflection('щетесь', 'таться', ['v1a'], ['v']),
    suffixInflection('щутся', 'таться', ['v1a'], ['v'])
];

// (1Cd) з - ж
// вязать, казаться, compounds of -казать
const presentSuffixInflections1Cd = [
    suffixInflection('жу', 'зать', ['v1a'], ['v']),
    suffixInflection('жешь', 'зать', ['v1a'], ['v']),
    suffixInflection('жет', 'зать', ['v1a'], ['v']),
    suffixInflection('жем', 'зать', ['v1a'], ['v']),
    suffixInflection('жете', 'зать', ['v1a'], ['v']),
    suffixInflection('жут', 'зать', ['v1a'], ['v']),

    suffixInflection('жусь', 'заться', ['v1a'], ['v']),
    suffixInflection('жешься', 'заться', ['v1a'], ['v']),
    suffixInflection('жется', 'заться', ['v1a'], ['v']),
    suffixInflection('жемся', 'заться', ['v1a'], ['v']),
    suffixInflection('жетесь', 'заться', ['v1a'], ['v']),
    suffixInflection('жутся', 'заться', ['v1a'], ['v'])
];


// (1Ce) с - ш
// писать
const presentSuffixInflections1Ce = [
    suffixInflection('шу', 'сать', ['v1a'], ['v']),
    suffixInflection('шешь', 'сать', ['v1a'], ['v']),
    suffixInflection('шет', 'сать', ['v1a'], ['v']),
    suffixInflection('шем', 'сать', ['v1a'], ['v']),
    suffixInflection('шете', 'сать', ['v1a'], ['v']),
    suffixInflection('шут', 'сать', ['v1a'], ['v']),

    suffixInflection('шусь', 'саться', ['v1a'], ['v']),
    suffixInflection('шешься', 'саться', ['v1a'], ['v']),
    suffixInflection('шется', 'саться', ['v1a'], ['v']),
    suffixInflection('шемся', 'саться', ['v1a'], ['v']),
    suffixInflection('шетесь', 'саться', ['v1a'], ['v']),
    suffixInflection('шутся', 'саться', ['v1a'], ['v'])
    ];


// (1Cf) г - ж
// двигать, брызгать
// as in движет, otherwise regular двигает
const presentSuffixInflections1Cf = [
    suffixInflection('жу', 'гать', ['v1a'], ['v']),
    suffixInflection('жешь', 'гать', ['v1a'], ['v']),
    suffixInflection('жет', 'гать', ['v1a'], ['v']),
    suffixInflection('жем', 'гать', ['v1a'], ['v']),
    suffixInflection('жете', 'гать', ['v1a'], ['v']),
    suffixInflection('жут', 'гать', ['v1a'], ['v']),

    suffixInflection('жусь', 'гаться', ['v1a'], ['v']),
    suffixInflection('жешься', 'гаться', ['v1a'], ['v']),
    suffixInflection('жется', 'гаться', ['v1a'], ['v']),
    suffixInflection('жемся', 'гаться', ['v1a'], ['v']),
    suffixInflection('жетесь', 'гаться', ['v1a'], ['v']),
    suffixInflection('жутся', 'гаться', ['v1a'], ['v'])
    ];

// (1Cg) к - ч
// плакать, алкать
const presentSuffixInflections1Cg = [
    suffixInflection('чу', 'кать', ['v1a'], ['v']),
    suffixInflection('чешь', 'кать', ['v1a'], ['v']),
    suffixInflection('чет', 'кать', ['v1a'], ['v']),
    suffixInflection('чем', 'кать', ['v1a'], ['v']),
    suffixInflection('чете', 'кать', ['v1a'], ['v']),
    suffixInflection('чут', 'кать', ['v1a'], ['v']),

    suffixInflection('чусь', 'каться', ['v1a'], ['v']),
    suffixInflection('чешься', 'каться', ['v1a'], ['v']),
    suffixInflection('чется', 'каться', ['v1a'], ['v']),
    suffixInflection('чемся', 'каться', ['v1a'], ['v']),
    suffixInflection('четесь', 'каться', ['v1a'], ['v']),
    suffixInflection('чутся', 'каться', ['v1a'], ['v'])
    ];

// (1Ch) х - ш
// махать, колыхать
const presentSuffixInflections1Ch = [
    suffixInflection('шу', 'хать', ['v1a'], ['v']),
    suffixInflection('шешь', 'хать', ['v1a'], ['v']),
    suffixInflection('шет', 'хать', ['v1a'], ['v']),
    suffixInflection('шем', 'хать', ['v1a'], ['v']),
    suffixInflection('шете', 'хать', ['v1a'], ['v']),
    suffixInflection('шут', 'хать', ['v1a'], ['v']),

    suffixInflection('шусь', 'хаться', ['v1a'], ['v']),
    suffixInflection('шешься', 'хаться', ['v1a'], ['v']),
    suffixInflection('шется', 'хаться', ['v1a'], ['v']),
    suffixInflection('шемся', 'хаться', ['v1a'], ['v']),
    suffixInflection('шетесь', 'хаться', ['v1a'], ['v']),
    suffixInflection('шутся', 'хаться', ['v1a'], ['v'])
    ];

// (1Ci) ск - щ
// искать
const presentSuffixInflections1Ci = [
    suffixInflection('щу', 'скать', ['v1a'], ['v']),
    suffixInflection('щешь', 'скать', ['v1a'], ['v']),
    suffixInflection('щет', 'скать', ['v1a'], ['v']),
    suffixInflection('щем', 'скать', ['v1a'], ['v']),
    suffixInflection('щете', 'скать', ['v1a'], ['v']),
    suffixInflection('щут', 'скать', ['v1a'], ['v']),

    suffixInflection('щусь', 'скаться', ['v1a'], ['v']),
    suffixInflection('щешься', 'скаться', ['v1a'], ['v']),
    suffixInflection('щется', 'скаться', ['v1a'], ['v']),
    suffixInflection('щемся', 'скаться', ['v1a'], ['v']),
    suffixInflection('щетесь', 'скаться', ['v1a'], ['v']),
    suffixInflection('щутся', 'скаться', ['v1a'], ['v'])
    ];

// (1Cj) adding л
// колебаться, дремать, капать
const presentSuffixInflections1Cj = [
    suffixInflection('лю', 'ать', ['v1a'], ['v']),
    suffixInflection('лешь', 'ать', ['v1a'], ['v']),
    suffixInflection('лет', 'ать', ['v1a'], ['v']),
    suffixInflection('лем', 'ать', ['v1a'], ['v']),
    suffixInflection('лете', 'ать', ['v1a'], ['v']),
    suffixInflection('лют', 'ать', ['v1a'], ['v']),

    suffixInflection('люсь', 'аться', ['v1a'], ['v']),
    suffixInflection('лешься', 'аться', ['v1a'], ['v']),
    suffixInflection('лется', 'аться', ['v1a'], ['v']),
    suffixInflection('лемся', 'аться', ['v1a'], ['v']),
    suffixInflection('летесь', 'аться', ['v1a'], ['v']),
    suffixInflection('лются', 'аться', ['v1a'], ['v'])
    ];

// (1D) Consonant stems III: verbs in ‐ти, ‐cть/‐зть, ‐чь
// (1DA) -ти
// A full list is provided p249/287
// (1DAa) -б-
// грести
const presentSuffixInflections1DAa = [
    suffixInflection('бу', 'сти', ['v1a'], ['v']),
    suffixInflection('бёшь', 'сти', ['v1a'], ['v']),
    suffixInflection('бёт', 'сти', ['v1a'], ['v']),
    suffixInflection('бём', 'сти', ['v1a'], ['v']),
    suffixInflection('бёте', 'сти', ['v1a'], ['v']),
    suffixInflection('бут', 'сти', ['v1a'], ['v']),

    suffixInflection('бусь', 'стися', ['v1a'], ['v']),
    suffixInflection('бёшься', 'стися', ['v1a'], ['v']),
    suffixInflection('бётся', 'стися', ['v1a'], ['v']),
    suffixInflection('бёмся', 'стися', ['v1a'], ['v']),
    suffixInflection('бётесь', 'стися', ['v1a'], ['v']),
    suffixInflection('бутся', 'стися', ['v1a'], ['v'])
    ];

// (1DAb) suffix and infinitive suffix (ти) coincide
// идти, везти, нести
const presentSuffixInflections1DAb = [
    suffixInflection('у', 'ти', ['v1a'], ['v']),
    suffixInflection('ёшь', 'ти', ['v1a'], ['v']),
    suffixInflection('ёт', 'ти', ['v1a'], ['v']),
    suffixInflection('ём', 'ти', ['v1a'], ['v']),
    suffixInflection('ёте', 'ти', ['v1a'], ['v']),
    suffixInflection('ут', 'ти', ['v1a'], ['v']),

    suffixInflection('усь', 'тися', ['v1a'], ['v']),
    suffixInflection('ёшься', 'тися', ['v1a'], ['v']),
    suffixInflection('ётся', 'тися', ['v1a'], ['v']),
    suffixInflection('ёмся', 'тися', ['v1a'], ['v']),
    suffixInflection('ётесь', 'тися', ['v1a'], ['v']),
    suffixInflection('утся', 'тися', ['v1a'], ['v'])
    ];

// (1DAc) -т-
// мести
const presentSuffixInflections1DAc = [
    suffixInflection('ту', 'сти', ['v1a'], ['v']),
    suffixInflection('тёшь', 'сти', ['v1a'], ['v']),
    suffixInflection('тёт', 'сти', ['v1a'], ['v']),
    suffixInflection('тём', 'сти', ['v1a'], ['v']),
    suffixInflection('тёте', 'сти', ['v1a'], ['v']),
    suffixInflection('тут', 'сти', ['v1a'], ['v']),

    suffixInflection('тусь', 'стися', ['v1a'], ['v']),
    suffixInflection('тёшься', 'стися', ['v1a'], ['v']),
    suffixInflection('тётся', 'стися', ['v1a'], ['v']),
    suffixInflection('тёмся', 'стися', ['v1a'], ['v']),
    suffixInflection('тётесь', 'стися', ['v1a'], ['v']),
    suffixInflection('тутся', 'стися', ['v1a'], ['v'])
    ];

// (1DAd) -ст-
// расти
const presentSuffixInflections1DAd = [
    suffixInflection('у', 'и', ['v1a'], ['v']),
    suffixInflection('ёшь', 'и', ['v1a'], ['v']),
    suffixInflection('ёт', 'и', ['v1a'], ['v']),
    suffixInflection('ём', 'и', ['v1a'], ['v']),
    suffixInflection('ёте', 'и', ['v1a'], ['v']),
    suffixInflection('ут', 'и', ['v1a'], ['v']),

    suffixInflection('усь', 'ися', ['v1a'], ['v']),
    suffixInflection('ёшься', 'ися', ['v1a'], ['v']),
    suffixInflection('ётся', 'ися', ['v1a'], ['v']),
    suffixInflection('ёмся', 'ися', ['v1a'], ['v']),
    suffixInflection('ётесь', 'ися', ['v1a'], ['v']),
    suffixInflection('утся', 'ися', ['v1a'], ['v'])
    ];

// (1DB) ‐cть/‐зть
// A list is included p249/287
// (1DBa) -д-
// класть
const presentSuffixInflections1DBa = [
    suffixInflection('ду', 'сть', ['v1a'], ['v']),
    suffixInflection('дёшь', 'сть', ['v1a'], ['v']),
    suffixInflection('дёт', 'сть', ['v1a'], ['v']),
    suffixInflection('дём', 'сть', ['v1a'], ['v']),
    suffixInflection('дёте', 'сть', ['v1a'], ['v']),
    suffixInflection('дут', 'сть', ['v1a'], ['v']),

    suffixInflection('дусь', 'сться', ['v1a'], ['v']),
    suffixInflection('дёшься', 'сться', ['v1a'], ['v']),
    suffixInflection('дётся', 'сться', ['v1a'], ['v']),
    suffixInflection('дёмся', 'сться', ['v1a'], ['v']),
    suffixInflection('дётесь', 'сться', ['v1a'], ['v']),
    suffixInflection('дутся', 'сться', ['v1a'], ['v'])
    ];

// (1DBb) -н-
// клясть
const presentSuffixInflections1DBb = [
    suffixInflection('ну', 'сть', ['v1a'], ['v']),
    suffixInflection('нёшь', 'сть', ['v1a'], ['v']),
    suffixInflection('нёт', 'сть', ['v1a'], ['v']),
    suffixInflection('нём', 'сть', ['v1a'], ['v']),
    suffixInflection('нёте', 'сть', ['v1a'], ['v']),
    suffixInflection('нут', 'сть', ['v1a'], ['v']),

    suffixInflection('нусь', 'сться', ['v1a'], ['v']),
    suffixInflection('нёшься', 'сться', ['v1a'], ['v']),
    suffixInflection('нётся', 'сться', ['v1a'], ['v']),
    suffixInflection('нёмся', 'сться', ['v1a'], ['v']),
    suffixInflection('нётесь', 'сться', ['v1a'], ['v']),
    suffixInflection('нутся', 'сться', ['v1a'], ['v'])
    ];

// (1DBc) -т-
// compounds of честь
const presentSuffixInflections1DBc = [
    suffixInflection('ту', 'есть', ['v1a'], ['v']),
    suffixInflection('тёшь', 'есть', ['v1a'], ['v']),
    suffixInflection('тёт', 'есть', ['v1a'], ['v']),
    suffixInflection('тём', 'есть', ['v1a'], ['v']),
    suffixInflection('тёте', 'есть', ['v1a'], ['v']),
    suffixInflection('тут', 'есть', ['v1a'], ['v']),

    suffixInflection('тусь', 'есться', ['v1a'], ['v']),
    suffixInflection('тёшься', 'есться', ['v1a'], ['v']),
    suffixInflection('тётся', 'есться', ['v1a'], ['v']),
    suffixInflection('тёмся', 'есться', ['v1a'], ['v']),
    suffixInflection('тётесь', 'есться', ['v1a'], ['v']),
    suffixInflection('тутся', 'есться', ['v1a'], ['v'])
    ];

// (1DBd) suffix and infinitive ending (ть) coincide
// лезть
const presentSuffixInflections1DBd = [
    suffixInflection('у', 'ть', ['v1a'], ['v']),
    suffixInflection('ешь', 'ть', ['v1a'], ['v']),
    suffixInflection('ет', 'ть', ['v1a'], ['v']),
    suffixInflection('ем', 'ть', ['v1a'], ['v']),
    suffixInflection('ете', 'ть', ['v1a'], ['v']),
    suffixInflection('ут', 'ть', ['v1a'], ['v']),

    suffixInflection('усь', 'ться', ['v1a'], ['v']),
    suffixInflection('ешься', 'ться', ['v1a'], ['v']),
    suffixInflection('ется', 'ться', ['v1a'], ['v']),
    suffixInflection('емся', 'ться', ['v1a'], ['v']),
    suffixInflection('етесь', 'ться', ['v1a'], ['v']),
    suffixInflection('утся', 'ться', ['v1a'], ['v'])
    ];

// (1DC) ‐чь
// A list is included p250/288
// (1DCa) г-ж stem
// беречь, мочь
const presentSuffixInflections1DCa = [
    suffixInflection('гу', 'чь', ['v1a'], ['v']),
    suffixInflection('жёшь', 'чь', ['v1a'], ['v']),
    suffixInflection('жёт', 'чь', ['v1a'], ['v']),
    suffixInflection('жём', 'чь', ['v1a'], ['v']),
    suffixInflection('жёте', 'чь', ['v1a'], ['v']),
    suffixInflection('гут', 'чь', ['v1a'], ['v']),

    suffixInflection('гусь', 'чься', ['v1a'], ['v']),
    suffixInflection('жёшься', 'чься', ['v1a'], ['v']),
    suffixInflection('жётся', 'чься', ['v1a'], ['v']),
    suffixInflection('жёмся', 'чься', ['v1a'], ['v']),
    suffixInflection('жётесь', 'чься', ['v1a'], ['v']),
    suffixInflection('гутся', 'чься', ['v1a'], ['v'])
    ];

// (1DCb) к-ч stem
// печь
const presentSuffixInflections1DCb = [
    suffixInflection('ку', 'чь', ['v1a'], ['v']),
    suffixInflection('ёшь', 'ь', ['v1a'], ['v']),
    suffixInflection('ёт', 'ь', ['v1a'], ['v']),
    suffixInflection('ём', 'ь', ['v1a'], ['v']),
    suffixInflection('ёте', 'ь', ['v1a'], ['v']),
    suffixInflection('кут', 'чь', ['v1a'], ['v']),

    suffixInflection('кусь', 'чься', ['v1a'], ['v']),
    suffixInflection('ёшься', 'ься', ['v1a'], ['v']),
    suffixInflection('ётся', 'ься', ['v1a'], ['v']),
    suffixInflection('ёмся', 'ься', ['v1a'], ['v']),
    suffixInflection('ётесь', 'ься', ['v1a'], ['v']),
    suffixInflection('кутся', 'чься', ['v1a'], ['v'])
    ];

// (2) Second-conjugation endings (-и-):
// All -ить verbs except a few (monosyllabic, почить, -шибить compounds)
// Many in -еть (list in book), some in -ать (list in book)
// Two in -ять: бояться, стоять
const presentSuffixInflections2 = [
    suffixInflection('ю', 'ить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('юсь', 'иться', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// Consonant changes
// This is a consistent feature of the second conjugation -ить -еть

// (2a) adding л to 1st p. sg.
// любить, ставить, графить, кормить, топить
const presentSuffixInflections2a = [
    suffixInflection('лю', 'ить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('люсь', 'иться', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2b) substituting ж to 1st p. sg. - д stem
// гладить
const presentSuffixInflections2b = [
    suffixInflection('жу', 'дить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('жусь', 'диться', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2c) substituting ж to 1st p. sg. - з stem
// лазить
const presentSuffixInflections2c = [
    suffixInflection('жу', 'зить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('жусь', 'зиться', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2d) substituting ш to 1st p. sg. - с stem
// просить
const presentSuffixInflections2d = [
    suffixInflection('шу', 'сить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('шусь', 'ситься', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2e) substituting ч to 1st p. sg. - т stem
// платить
const presentSuffixInflections2e = [
    suffixInflection('чу', 'тить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('чусь', 'титься', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2f) substituting щ to 1st p. sg. - т stem
// прекратить (rarer than other mutation)
const presentSuffixInflections2f = [
    suffixInflection('щу', 'тить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('щусь', 'титься', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];

// (2g) substituting щ to 1st p. sg. - ст stem
// мстить
const presentSuffixInflections2g = [
    suffixInflection('щу', 'стить', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('е', 'ь', ['v1a'], ['v']),
    suffixInflection('ят', 'ить', ['v1a'], ['v']),

    suffixInflection('щусь', 'ститься', ['v1b'], ['v']),
    suffixInflection('шься', 'ться', ['v1b'], ['v']),
    suffixInflection('ся', 'ься', ['v1b'], ['v']),
    suffixInflection('мся', 'ться', ['v1b'], ['v']),
    suffixInflection('есь', 'ься', ['v1b'], ['v']),
    suffixInflection('ятся', 'иться', ['v1b'], ['v'])
];


// (2h) adding л to 1st p. sg. -еть ending
// шуметь, храпеть
const presentSuffixInflections2h = [
    suffixInflection('лю', 'еть', ['v1a'], ['v']),
    suffixInflection('ишь', 'еть', ['v1a'], ['v']),
    suffixInflection('ит', 'еть', ['v1a'], ['v']),
    suffixInflection('им', 'еть', ['v1a'], ['v']),
    suffixInflection('ите', 'еть', ['v1a'], ['v']),
    suffixInflection('ят', 'еть', ['v1a'], ['v']),

    suffixInflection('люсь', 'еться', ['v1b'], ['v']),
    suffixInflection('ишься', 'еться', ['v1b'], ['v']),
    suffixInflection('ится', 'еться', ['v1b'], ['v']),
    suffixInflection('имся', 'еться', ['v1b'], ['v']),
    suffixInflection('итесь', 'еться', ['v1b'], ['v']),
    suffixInflection('ятся', 'еться', ['v1b'], ['v'])
];

// (2i) substituting щ to 1st p. sg. - ст stem -еть ending
// свистеть
const presentSuffixInflections2i = [
    suffixInflection('щу', 'стеть', ['v1a'], ['v']),
    suffixInflection('ишь', 'еть', ['v1a'], ['v']),
    suffixInflection('ит', 'еть', ['v1a'], ['v']),
    suffixInflection('им', 'еть', ['v1a'], ['v']),
    suffixInflection('ите', 'еть', ['v1a'], ['v']),
    suffixInflection('ят', 'еть', ['v1a'], ['v']),

    suffixInflection('щусь', 'стеться', ['v1b'], ['v']),
    suffixInflection('ишься', 'еться', ['v1b'], ['v']),
    suffixInflection('ится', 'еться', ['v1b'], ['v']),
    suffixInflection('имся', 'еться', ['v1b'], ['v']),
    suffixInflection('итесь', 'еться', ['v1b'], ['v']),
    suffixInflection('ятся', 'еться', ['v1b'], ['v'])
];

// (3) Irregulars
// (3a) бежать - г for 1st p. sg. & 3rd p. pl. - г stem
const presentSuffixInflections3a = [
    suffixInflection('гу', 'жать', ['v1a'], ['v']),
    suffixInflection('ишь', 'ать', ['v1a'], ['v']),
    suffixInflection('ит', 'ать', ['v1a'], ['v']),
    suffixInflection('им', 'ать', ['v1a'], ['v']),
    suffixInflection('ите', 'ать', ['v1a'], ['v']),
    suffixInflection('гут', 'ать', ['v1a'], ['v']),

    suffixInflection('гусь', 'жаться', ['v1b'], ['v']),
    suffixInflection('ишься', 'аться', ['v1b'], ['v']),
    suffixInflection('ится', 'аться', ['v1b'], ['v']),
    suffixInflection('имся', 'аться', ['v1b'], ['v']),
    suffixInflection('итесь', 'аться', ['v1b'], ['v']),
    suffixInflection('гутся', 'жаться', ['v1b'], ['v'])
];

// (3b) есть 
const presentSuffixInflections3b = [
    suffixInflection('м', 'сть', ['v1a'], ['v']),
    suffixInflection('шь', 'сть', ['v1a'], ['v']),
    suffixInflection('', 'ь', ['v1a'], ['v']),
    suffixInflection('дим', 'сть', ['v1a'], ['v']),
    suffixInflection('дите', 'сть', ['v1a'], ['v']),
    suffixInflection('дят', 'сть', ['v1a'], ['v']),

    suffixInflection('мся', 'сться', ['v1a'], ['v']),
    suffixInflection('шься', 'сться', ['v1a'], ['v']),
    suffixInflection('ся', 'ься', ['v1a'], ['v']),
    suffixInflection('димся', 'сться', ['v1a'], ['v']),
    suffixInflection('дитесь', 'сться', ['v1a'], ['v']),
    suffixInflection('дятся', 'сться', ['v1a'], ['v'])
];

// (3c) хотеть
const presentSuffixInflections3c = [
    suffixInflection('чу', 'теть', ['v1a'], ['v']),
    suffixInflection('чешь', 'теть', ['v1a'], ['v']),
    suffixInflection('ит', 'еть', ['v1a'], ['v']),
    suffixInflection('им', 'еть', ['v1a'], ['v']),
    suffixInflection('ите', 'еть', ['v1a'], ['v']),
    suffixInflection('ят', 'еть', ['v1a'], ['v']),

    suffixInflection('чусь', 'теться', ['v1a'], ['v']),
    suffixInflection('чешься', 'теться', ['v1a'], ['v']),
    suffixInflection('ится', 'еться', ['v1a'], ['v']),
    suffixInflection('имся', 'еться', ['v1a'], ['v']),
    suffixInflection('итесь', 'еться', ['v1a'], ['v']),
    suffixInflection('ятся', 'еться', ['v1a'], ['v'])
];

// (3d) дать
const presentSuffixInflections3d = [
    suffixInflection('м', 'ть', ['v1a'], ['v']),
    suffixInflection('шь', 'ть', ['v1a'], ['v']),
    suffixInflection('ст', 'ть', ['v1a'], ['v']),
    suffixInflection('дим', 'ть', ['v1a'], ['v']),
    suffixInflection('дите', 'ть', ['v1a'], ['v']),
    suffixInflection('дут', 'ть', ['v1a'], ['v']),

    suffixInflection('мся', 'ться', ['v1a'], ['v']),
    suffixInflection('шься', 'ться', ['v1a'], ['v']),
    suffixInflection('стся', 'ться', ['v1a'], ['v']),
    suffixInflection('димся', 'ться', ['v1a'], ['v']),
    suffixInflection('дитесь', 'ться', ['v1a'], ['v']),
    suffixInflection('дутся', 'ться', ['v1a'], ['v'])
];

// To be added:
// Consonant variations ж, ч, ш, щ, where у and а replace ю and я
// Stress variations: ё/е