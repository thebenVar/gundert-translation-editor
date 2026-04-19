const fs = require('fs');
const path = require('path');

const files = [
    { name: '94XXAFFR.SFM', category: 'Fauna' },
    { name: '95XXBFFR.SFM', category: 'Flora' },
    { name: '96XXCFFR.SFM', category: 'Realia' }
];

const analyze = () => {
    const stats = {
        totalEntries: 0,
        totalWords: 0,
        dictionaries: []
    };

    files.forEach(fileInfo => {
        const filePath = path.join(__dirname, fileInfo.name);
        if (!fs.existsSync(filePath)) {
            console.warn(`File ${fileInfo.name} not found!`);
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        let entryCount = 0;
        let wordCount = 0;
        let charCount = 0;

        lines.forEach(line => {
            if (line.startsWith('\\key ')) {
                // Ignore keys like 0, 0.1 etc if they seem to be intro sections
                const keyVal = line.substring(5).trim();
                if (keyVal !== '0' && keyVal !== '0.1') {
                    entryCount++;
                }
            }
            
            // Basic word count estimation (strip markers)
            const cleanedLine = line.replace(/\\[a-z*]+\b/g, '').trim();
            if (cleanedLine) {
                const words = cleanedLine.split(/\s+/).filter(w => w.length > 0);
                wordCount += words.length;
                charCount += cleanedLine.length;
            }
        });

        const dictStats = {
            name: fileInfo.name,
            category: fileInfo.category,
            entries: entryCount,
            words: wordCount,
            characters: charCount,
            avgWordsPerEntry: entryCount > 0 ? Math.round(wordCount / entryCount) : 0
        };

        stats.dictionaries.push(dictStats);
        stats.totalEntries += entryCount;
        stats.totalWords += wordCount;
    });

    fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
    console.log('Successfully generated stats.json');
    console.table(stats.dictionaries);
};

analyze();
