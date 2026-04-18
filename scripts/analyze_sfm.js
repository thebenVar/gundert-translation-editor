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
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        let entryCount = 0;
        let wordCount = 0;
        let charCount = 0;
        let currentSection = null;
        const sections = [];

        lines.forEach(line => {
            if (line.startsWith('\\key ')) {
                const keyVal = line.substring(5).trim();
                // A section is typically a top-level key (e.g., "1", "2")
                // while sub-sections are "1.1", "1.2", and entries are "1.1.1" etc.
                // For simplified project management, we'll track top-level sections as 'Categories'
                
                const isTopLevel = !keyVal.includes('.');
                const isSubLevel = (keyVal.match(/\./g) || []).length === 1;

                if (keyVal !== '0' && keyVal !== '0.1') {
                    entryCount++;
                }
                
                // Track the section hierarchy
                const nextLineIndex = lines.indexOf(line) + 1;
                let title = "Unknown";
                if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('\\title ')) {
                    title = lines[nextLineIndex].substring(7).trim();
                }

                if (isTopLevel && keyVal !== '0') {
                    currentSection = {
                        key: keyVal,
                        title: title,
                        entries: 0,
                        words: 0
                    };
                    sections.push(currentSection);
                } else if (currentSection) {
                    currentSection.entries++;
                }
            }
            
            const cleanedLine = line.replace(/\\[a-z*]+\b/g, '').trim();
            if (cleanedLine) {
                const words = cleanedLine.split(/\s+/).filter(w => w.length > 0);
                wordCount += words.length;
                charCount += cleanedLine.length;
                if (currentSection) {
                    currentSection.words += words.length;
                }
            }
        });

        const dictStats = {
            name: fileInfo.name,
            category: fileInfo.category,
            entries: entryCount,
            words: wordCount,
            characters: charCount,
            avgWordsPerEntry: entryCount > 0 ? Math.round(wordCount / entryCount) : 0,
            sections: sections
        };

        stats.dictionaries.push(dictStats);
        stats.totalEntries += entryCount;
        stats.totalWords += wordCount;
    });

    fs.writeFileSync(path.join(__dirname, '..', 'data', 'stats.json'), JSON.stringify(stats, null, 2));
    console.log('Successfully generated stats.json with section breakdown');
};

analyze();
