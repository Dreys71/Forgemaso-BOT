const sqlite3 = require('sqlite3').verbose();
const Discord = require('discord.js');
const auth = require('./auth.json');
const editJsonFile = require("edit-json-file");
const forgemaso = require("./forgemaso.js");
const client = new Discord.Client();

let db = new sqlite3.Database('./db/ladder.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the forgemaso database.');
});


client.login(auth.token);
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('!fm.help', {type: 'WATCHING'})
});

async function updateUser(user, is_succeed, points){
    return new Promise(resolve => {
        db.get(`SELECT * FROM ladder WHERE user_id = ?`, [user.id], function (err, row) {
            if(err){
                console.log("err update_user", err);
            } else{
                // USER EXIST
                if(row){
                    // UPDATE USER SCORE TO 0
                    // TODO : Look for add previous score in all time ladder
                    if(is_succeed === false){
                        db.run("UPDATE ladder SET pts = 0, multiplicator = 100 WHERE user_id = ?", [user.id], function (err) {
                            if(err){
                                console.log("User exist / Lose", err)
                            }
                            else {
                                resolve({state : false, pts: 0, multiplicator: 100})
                            }
                        });
                    }
                    // UPDATE NEW SCORE
                    else {
                        db.get('SELECT * FROM ladder WHERE user_id = ?', [user.id], function (err, row) {
                            let score = ( Math.log2(points).toFixed(2) * (row.multiplicator / 100)) + row.pts;
                            let newMultiplicator = row.multiplicator + points
                            db.run("UPDATE ladder SET pts = ?, multiplicator = ? WHERE user_id = ?", [score, newMultiplicator, user.id], function (err) {
                                if(err){
                                    console.log("UPDATE USER / WINNER", err)
                                }
                            })
                            db.run('UPDATE best SET max = ? WHERE user_id = ? AND max < ?',[score, user.id, score], function (err) {
                                if(err){
                                    console.log("update best error", err)
                                }
                            });
                            resolve({state: true, pts: score, row, multiplicator: newMultiplicator})
                        })

                    }
                }
                // USER DON'T EXIST
                else {
                    // create new user with score 0
                    if(is_succeed === false){

                        db.run('INSERT INTO ladder(user_id,pseudo, pts, multiplicator) VALUES(?,?,0,100)', [user.id, user.name], function (err) {
                            if(err){
                                console.log("User don't exist / Lose", err)
                            }
                            else {
                                db.run('INSERT INTO best(user_id, max) VALUES(?,0)',[user.id], function (err) {
                                    if(err){
                                        console.log("insert into", err)
                                    }

                                })
                                resolve({state : false, pts: 0, multiplicator: 100});
                            }
                        });
                    }
                    // create new user with score = score
                    else {
                        let newMultiplicator = 100 + points
                        db.run('INSERT INTO ladder(user_id,pseudo, pts, multiplicator) VALUES(?,?,?)', [user.id, user.name, points, newMultiplicator], function (err) {
                            if(err){
                                console.log("User don't exist / Lose", err)
                            }
                            else {
                                db.run('INSERT INTO best(user_id, max) VALUES(?,?)',[user.id, score], function (err) {
                                    console.log("insert 2 best", err)
                                })
                                resolve({state : false, pts: score, multiplicator: newMultiplicator});
                            }
                        });
                    }
                }
            }
        });
    });

}

async function getGuildCurrent(str) {
    return new Promise(resolve => {
        db.all("SELECT * FROM ladder WHERE user_id IN (" + str + ") ORDER BY pts DESC LIMIT 100", function (err, row) {
            if(err){
                console.log("getGuildCurrent", err)
            }
            else {
                resolve(row)
            }
        })
    })
}

async function getGuildAllTime(str) {
    return new Promise(resolve => {
        db.all("SELECT * FROM ladder, best WHERE ladder.user_id IN (" + str + ") AND ladder.user_id = best.user_id ORDER BY max DESC LIMIT 100", function (err, row) {
            if(err){
                console.log("getGuildAllTime",err)
            }
            else {
                resolve(row)
            }
        })
    })
}

async function getGlobalCurrent() {
    return new Promise(resolve => {
        db.all("SELECT * FROM ladder ORDER BY pts DESC LIMIT 100", function (err, row) {
            if(err){
                console.log("GGC",err)
            }
            else {
                resolve(row)
            }
        })
    })
}

async function getGlobalAllTime() {
    return new Promise(resolve => {
        db.all("SELECT * FROM ladder, best WHERE ladder.user_id = best.user_id ORDER BY max DESC LIMIT 100", function (err, row) {
            if(err){
                console.log("GGALT",err)
            }
            else {
                resolve(row)
            }
        })
    })
}

let runes = editJsonFile('./runes.json')
let runesStats = editJsonFile('./runes-stats.json',{
    autosave: true
})
let antispam = editJsonFile('./antispam.json',{
    autosave: true
})
async function antiSpam(iduser) {
    return new Promise(resolve => {
       let spam_user =  antispam.get(iduser)
        if(spam_user == null){
            antispam.set(iduser, {entry: Date.now()});
            resolve(true)
        }
        else {
            if(Date.now() - spam_user.entry < 2000){
                antispam.set(iduser, {entry: Date.now() + 10000});
                resolve(false)
            }
            else{
                antispam.set(iduser, {entry: Date.now()});
                resolve(true)
            }
        }
    })

}
function stat(rune, state) {
    let s = runesStats.get(rune)
    if(state === false){
        runesStats.set(rune, {
            "use": s.use + 1,
            "fail": s.fail + 1
        })
    }
    else {
        runesStats.set(rune, {
            "use": s.use + 1,
            "win": s.win + 1
        })
    }

}

client.on('message', msg => {
    if (msg.content.substring(0, 1) === '!') {

        let user = {id: msg.author.id, name: msg.author.username}
        let params = {rune: 'fo', win: 2}
        let args = msg.content.substring(1).split(' ');

        switch (args[0]) {
            case 'fm' :
                antiSpam(user.id).then(rep => {
                    if(rep === false){
                        msg.reply("Le spam n'est pas autorisé. Un message toute les 2 secondes.\n10 secondes de santion sont ajoutée.")
                    }
                    else {
                        /** Looking for rune name param **/
                        if (args[1]) {
                            let rune = runes.get(args[1])
                            if (Number.isInteger(rune)) {
                                params = {rune: args[1], win: rune}
                            }
                        }
                        let response = forgemaso.calc(params.win)
                        updateUser(user, response, params.win).then(result => {
                            stat(params.rune, result.state)
                            if (result.state === false) {
                                msg.reply(":x: Echec | Votre score est de " + result.pts.toFixed(2) + " | Multiplicateur actuel : " + result.multiplicator + "%");
                            }
                            else {
                                msg.reply(":white_check_mark: Succès | Votre score est de " + result.pts.toFixed(2) + " | Multiplicateur actuel : " + result.multiplicator + "%");
                            }
                        })
                    }
                });

                break;
            case 'fm.help' :
                //let embed = new Discord.RichEmbed()
                msg.channel.send({
                    embed: {
                        "title": "Documentation",
                        "description": "Règles du jeu ainsi que la liste des commandes.",
                        "color": 7379760,
                        "timestamp": new Date(),
                        "footer": {
                            "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                            "text": "Forgemaso"
                        },
                        "image": {
                            "url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256"
                        },
                        "author": {
                            "name": "Forgemaso"
                        },
                        "fields": [
                            {
                                "name": "Rêgles du jeu",
                                "value": "Ce jeu reprend le concepte du MASO et y ajoutant l'univers de la forgemagie.\n\nChacun de vous disposez d'un compteur de points unique (identique sur tous les serveurs discord)\n\nCe compteur évolura au fur et à mesure que vous y passerez des runes.\nChaque rune à une chance de succès définie et vous rapporte un nombre de points en concéquence.\n\nPS : Si la rune ne passe pas votre compteur retombe à 0"
                            },
                            {
                                "name": "Listes des commandes utilisables",
                                "value": "``!fm <rune>`` : Tentative de FM, la rune est facultative. La rune par défaut à une chance de réussir à 1/2\n``!fm.help`` : Affiche cette documentation\n``!fm.runes`` : Affichera la liste des runes utilisables avec leur chance de succès"

                            },
                            {
                                "name": "Classement",
                                "value": "Il y a 4 classements différents :\n``!fm.ladder`` Affiche le classement actuel du serveur discord\n``!fm.gladder`` Affiche le classement actuel global (TOP100)\n``!fm.best`` Affiche le classement absolu de votre serveur discord (Les meilleurs scores)\n``!fm.gbest`` Affiche le classement absolu global (TOP100)\n\nLa commande ``!fm.score`` vous affiche votre score actuel, votre multiplicateur ainsi que vos positions dans les différents ladder"
                            },
                            {
                                "name": "Les points",
                                "value": "Le nombre de point obtenu pour un passage de rune est le logarythme base 2 de la proba :\nUne rune 1/2 rapportera log2(2) => 1 point\nUne rune 1/4 rapportera  log2(4) => 2 points\nUne rune 1/8 rapportera  log2(8) => 3 points\nUne rune 1/16 rapportera  log2(16) => 4 points\nUne rune 1/32 rapportera  log2(32) => 5 points\nUne rune 1/50 rapportera  log2(50) => 5.64 points\nUne rune 1/100 rapportera  log2(100) => 6.64 points"
                            },
                            {
                                "name": "Le multiplicateur de points",
                                "value": "Il a pour valeur initial 100%, chaque rune passée multipliera votre nombre de points par le multiplicateur actuel.\n\nLe multiplicateur évolu selon les risques pris :\nA chaque tentative réussie, le multiplicateur augmentera selon la rune passée."
                            },
                            {
                                "name" : "Statistiques",
                                "value" : "Utilisé la commande ``!fm.stats`` pour obtenir les statistiques liées au bot :)"
                            }
                        ]
                    }
                });
                break;
            case 'fm.ladder' :
                let ids = [];
                msg.guild.members.forEach(member => {
                    ids.push(member.id)
                });
                getGuildCurrent(ids.join()).then(result => {
                    let str = [];
                    let suite_str = "";
                    let p = 1;
                    result.forEach(function (t) {
                        if (p == 1) {
                            str.push({
                                "name": ":first_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else if (p == 2) {
                            str.push({
                                "name": ":second_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else if (p == 3) {
                            str.push({
                                "name": ":third_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else {
                            suite_str += "\n" + p + " | **" + t.pseudo + "** ( " + t.pts.toFixed(2) + " pts )"
                        }
                        p++
                    });

                    if (p > 4) {
                        str.push({"name": "La suite du classement", "value": suite_str})
                    }
                    let response = {
                        "title": "**LADDER ACTUEL DU SERVEUR**",
                        "color": 7379760,
                        "timestamp": new Date(),
                        "footer": {
                            "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                            "text": "Forgemaso"
                        },
                        "fields": str,
                        "author": {
                            "name": "Forgemaso"
                        }
                    }
                    msg.channel.send({
                        embed: response
                    });
                })
                break;
            case 'fm.gladder' :
                getGlobalCurrent().then(result => {
                    let str = [];
                    let suite_str = "";
                    let p = 1;
                    result.forEach(function (t) {
                        if (p == 1) {
                            str.push({
                                "name": ":first_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else if (p == 2) {
                            str.push({
                                "name": ":second_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else if (p == 3) {
                            str.push({
                                "name": ":third_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.pts.toFixed(2) + " points."
                            })
                        }
                        else {
                            suite_str += "\n" + p + " | **" + t.pseudo + "** ( " + t.pts.toFixed(2) + " pts )"
                        }
                        p++
                    });

                    if (p > 4) {
                        str.push({"name": "La suite du classement", "value": suite_str})
                    }
                    let response = {
                        "title": "**LADDER ACTUEL GLOBAL**",
                        "color": 7379760,
                        "timestamp": new Date(),
                        "footer": {
                            "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                            "text": "Forgemaso"
                        },
                        "fields": str,
                        "author": {
                            "name": "Forgemaso"
                        }
                    }
                    msg.channel.send({
                        embed: response
                    });
                })
                break;
            case 'fm.best':
                let idsbest = [];
                msg.guild.members.forEach(member => {
                    idsbest.push(member.id)
                });
                getGuildAllTime(idsbest.join()).then(result => {
                    let str = [];
                    let suite_str = "";
                    let p = 1;
                    result.forEach(function (t) {
                        if (p == 1) {
                            str.push({
                                "name": ":first_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else if (p == 2) {
                            str.push({
                                "name": ":second_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else if (p == 3) {
                            str.push({
                                "name": ":third_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else {
                            suite_str += "\n" + p + " | **" + t.pseudo + "** ( " + t.max.toFixed(2) + " pts )"
                        }
                        p++
                    });

                    if (p > 4) {
                        str.push({"name": "La suite du classement", "value": suite_str})
                    }
                    let response = {
                        "title": "**LADDER ABSOLU DU SERVEUR**",
                        "color": 7379760,
                        "timestamp": new Date(),
                        "footer": {
                            "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                            "text": "Forgemaso"
                        },
                        "fields": str,
                        "author": {
                            "name": "Forgemaso"
                        }
                    }
                    msg.channel.send({
                        embed: response
                    });
                })
                break;
            case 'fm.gbest' :
                getGlobalAllTime().then(result => {
                    let str = [];
                    let suite_str = "";
                    let p = 1;
                    result.forEach(function (t) {
                        if (p == 1) {
                            str.push({
                                "name": ":first_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else if (p == 2) {
                            str.push({
                                "name": ":second_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else if (p == 3) {
                            str.push({
                                "name": ":third_place: **" + t.pseudo + "**",
                                "value": "Avec le score de " + t.max.toFixed(2) + " points."
                            })
                        }
                        else {
                            suite_str += "\n" + p + " | **" + t.pseudo + "** ( " + t.max.toFixed(2) + " pts )"
                        }
                        p++
                    });

                    if (p > 4) {
                        str.push({"name": "La suite du classement", "value": suite_str})
                    }
                    let response = {
                        "title": "**LADDER ABSOLU GLOBAL**",
                        "color": 7379760,
                        "timestamp": new Date(),
                        "footer": {
                            "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                            "text": "Forgemaso"
                        },
                        "fields": str,
                        "author": {
                            "name": "Forgemaso"
                        }
                    }
                    msg.channel.send({
                        embed: response
                    });
                })
                break;
            case 'fm.runes' :
                let runesList = runes.get()
                let str = "";
                Object.keys(runesList).map(function (objectKey) {
                    let t = runesList[objectKey];
                    str = str + "\nLa rune " + objectKey + " est à 1/" + t
                });
                let resp = {
                    "title": "Les runes",
                    "color": 7379760,
                    "timestamp": new Date(),
                    "footer": {
                        "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                        "text": "Forgemaso"
                    },
                    "fields": [
                        {
                            "name": "Liste des runes utilisabels",
                            "value": str
                        },
                        {
                            "name": "Utilisation",
                            "value": "Pour utiliser une rune, utilisé la commande ``!fm <rune>``\nEx : Pour la rune PA : ``!fm pa``"
                        }
                    ],
                    "author": {
                        "name": "Forgemaso"
                    }
                }
                msg.channel.send({
                    embed: resp
                });
                break;
            case 'fm.stats' :
                let stats = runesStats.get();
                let r_stats = []
                Object.keys(stats).map(function(objectKey) {
                    let stat = stats[objectKey];
                    if(stat.use != 0){
                        r_stats.push({
                            "name": "Rune " + objectKey + " ( 1/" + stat.pts + " soit **" + (100/stat.pts).toFixed(2) +"% ** théorique)",
                            "value" : "Utilisée **" + stat.use + "** fois. **" + stat.win + "** ont été un succès. Soit **" + (stat.win * 100 / stat.use).toFixed(2) + "%** de succès"
                        })
                    }
                    else {
                        r_stats.push({
                            "name": "Rune " + objectKey + " ( 1/" + stat.pts + " soit **" + (100/stat.pts).toFixed(2) +"% ** théorique)",
                            "value" : "La rune n'a jamais été utilisée."
                        })
                    }

                });




                let resp_stats = {
                    "title": "**STATISTIQUES**",
                    "color": 7379760,
                    "timestamp": new Date(),
                    "footer": {
                        "icon_url": "https://cdn.discordapp.com/app-icons/491856512562495488/70d660e95bf17533dceb3dcc805ea657.png?size=256",
                        "text": "Forgemaso"
                    },
                    "fields": r_stats,
                    "author": {
                        "name": "Forgemaso"
                    }
                }
                msg.channel.send({
                    embed: resp_stats
                });
                break;
        }
    }
});