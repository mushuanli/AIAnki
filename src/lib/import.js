// @ts-check
"use strict"

const sqlite3 = require('sqlite3').verbose();
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

async function importNewData() {
    const db = new sqlite3.Database(config.ANKI_COLLECTION_FILE);

    try {
        const jsonFiles = ['yours.json']; //fs.readdirSync(config.JSON_DIR).filter(file => file.endsWith('.json'));
        console.log("Json files found: ", jsonFiles);

        // Read in the collection row
        const collectionRow = await getCollectionRow(db);

        // Get the Model from your col row.
        const models = JSON.parse(collectionRow.models);
        const firstModelKey = Object.keys(models)[0];
        const model = models[firstModelKey];

        // Get the deck from your col row
        const decks = JSON.parse(collectionRow.decks);
        const firstDeckKey = Object.keys(decks)[0];
        const deck = decks[firstDeckKey];

        const mediaDir = path.join(path.dirname(config.ANKI_COLLECTION_FILE), config.MEDIA_DIR);
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }
        for (const jsonFile of jsonFiles) {
            const jsonPath = path.join(config.JSON_DIR, jsonFile);
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            console.log(`Processing: ${jsonFile}`);

            //Copy media to new folder
            const mediaMap = {};
            for (const file of [jsonData.audio, jsonData.audio_example, jsonData.image]) {
                if (file && (file.endsWith(".mp3") || file.endsWith(".png"))) {
                    const newFilename = `${Date.now()}-${file}`;
                    const oldFile = path.join(file.endsWith(".mp3") ? config.AUDIO_DIR : config.IMAGE_DIR, file);
                    const newFile = path.join(mediaDir, newFilename);
                    fs.copyFileSync(oldFile, newFile);
                    mediaMap[file] = newFilename;
                }
            }


            const fields = [
                "", //"个人笔记"
                "七下", //"grade"
                jsonData.unit,
                jsonData.name,
                jsonData.symbol,
                jsonData.chn,
                (jsonData.image ? `<img src="${mediaMap[jsonData.image]}">` : ""),
                jsonData.example_en,
                (jsonData.audio_example ? `[sound:${mediaMap[jsonData.audio_example]}]` : ""),
                (jsonData.audio ? `[sound:${mediaMap[jsonData.audio]}]` : ""),
                "",
            ].join('\x1f');

            const note = {
                id: Date.now(),
                guid: uuidv4(),
                mid: model.id,
                mod: Date.now(),
                usn: -1,
                tags: "",
                flds: fields,
                sfld: jsonData.name,
                csum: 0,
                flags: 0,
                data: "",
            };

            const newNoteId = await insertNote(db, note);
            console.log(`Inserted note with id: ${newNoteId} `);

             // Create two cards
             const card1 = {
                id: Date.now(),
                nid: newNoteId,
                did: deck.id,
                ord: 0, // First card, ord 0
                mod: Date.now(),
                usn: -1,
                type: 0,
                queue: 0,
                due: 0,
                ivl: 0,
                factor: 2500,
                reps: 0,
                lapses: 0,
                left: 0,
                odue: 0,
                odid: 0,
                flags: 0,
                data: "",
            };

            const card2 = {
               id: Date.now() + 1, // ensure a different id
               nid: newNoteId,
               did: deck.id,
               ord: 1, // Second card, ord 1
               mod: Date.now(),
               usn: -1,
               type: 0,
               queue: 0,
               due: 0,
               ivl: 0,
               factor: 2500,
               reps: 0,
               lapses: 0,
               left: 0,
               odue: 0,
               odid: 0,
               flags: 0,
               data: "",
           };

           await insertCard(db, card1);
           await insertCard(db, card2);
        }

        console.log('Finished processing all JSON files.');

    } catch (error) {
        console.error('Error processing files', error);
    } finally {
        db.close();

        // Create apkg
        try {
            const zip = new AdmZip();
            zip.addLocalFile(config.ANKI_COLLECTION_FILE);
            const mediaDir = path.join(path.dirname(config.ANKI_COLLECTION_FILE), config.MEDIA_DIR);
             if (fs.existsSync(mediaDir)) {
                const files = fs.readdirSync(mediaDir);
                for (const file of files) {
                    const filePath = path.join(mediaDir, file);
                   zip.addLocalFile(filePath,`media/${file}`);
                }
             }
            const apkgPath = path.join(path.dirname(config.ANKI_COLLECTION_FILE), 'output.apkg')
            zip.writeZip(apkgPath);
            console.log(`Successfully created apkg file at: ${apkgPath}`);
          } catch (error) {
               console.error('Error creating apkg file', error);
         }
    }

}

async function getCollectionRow(db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM col LIMIT 1', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function insertNote(db, note) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(note),
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

async function insertCard(db, card) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(card),
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

// Run the script
module.exports = {importNewData};