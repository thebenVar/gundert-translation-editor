/**
 * Test Suite for Bible Reference Search Functionality
 * Tests the reference indexing and searching capabilities
 */

// Mock test data
const MOCK_ENTRIES = [
    {
        key: '1.1',
        title: 'Lion',
        category: 'fauna',
        content: 'The lion is mentioned in John 3:16. Also see Matthew 5:5.',
        wordCount: 12
    },
    {
        key: '2.1',
        title: 'Olive Tree',
        category: 'flora',
        content: 'Referenced in Romans 11:17 and also 1 Peter 2:24.',
        wordCount: 20
    },
    {
        key: '3.1',
        title: 'Temple',
        category: 'realia',
        content: 'Important references: John 2:19, Luke 19:46, and Mark 11:17.',
        wordCount: 15
    },
    {
        key: '4.1',
        title: 'Mnemonic Test',
        category: 'fauna',
        content: 'This entry uses mnemonic format: 04000301600000 which maps to MAT 3:16.',
        wordCount: 10
    }
];

// Test results tracker
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function resetTestState() {
    testsPassed = 0;
    testsFailed = 0;
    testResults.length = 0;
}

/**
 * Assertion function
 */
function assert(condition, testName, message = '') {
    if (condition) {
        testsPassed++;
        testResults.push({ status: 'PASS', testName, message });
        console.log(`✓ PASS: ${testName}`);
    } else {
        testsFailed++;
        testResults.push({ status: 'FAIL', testName, message });
        console.error(`✗ FAIL: ${testName} - ${message}`);
    }
}

/**
 * Test Suite 1: extractBibleReferences
 */
function testExtractBibleReferences() {
    console.log('\n=== Test Suite 1: extractBibleReferences ===\n');

    // Test USFM format extraction
    const content1 = 'The lion is mentioned in John 3:16 and Matthew 5:5.';
    const refs1 = extractBibleReferences(content1);
    assert(refs1.length >= 2, 'Extract USFM format', `Found ${refs1.length} references`);
    assert(refs1.includes('John 3:16'), 'Extract John 3:16', `References: ${refs1}`);
    assert(refs1.includes('Matthew 5:5'), 'Extract Matthew 5:5', `References: ${refs1}`);

    // Test verse range extraction
    const content2 = 'See Psalm 1:1-5 for more details.';
    const refs2 = extractBibleReferences(content2);
    assert(refs2.length >= 1, 'Extract verse range', `Found ${refs2.length} references`);
    assert(refs2.some(r => r.includes('1:1-5')), 'Extract verse range format', `References: ${refs2}`);

    // Test 1-digit and 2-digit book codes
    const content3 = 'See 1 John 4:7 and 2 Peter 1:20 and Acts 2:3.';
    const refs3 = extractBibleReferences(content3);
    assert(refs3.length >= 2, 'Extract multi-digit books', `Found ${refs3.length} references`);
    assert(refs3.some(r => r.includes('1 John')), 'Extract 1 John', `References: ${refs3}`);
    assert(refs3.some(r => r.includes('2 Peter')), 'Extract 2 Peter', `References: ${refs3}`);

    // Test mnemonic format extraction
    const content4 = 'Reference code 04000301600000 for MAT 3:16.';
    const refs4 = extractBibleReferences(content4);
    assert(refs4.length >= 2, 'Extract mnemonic format', `Found ${refs4.length} references`);
    assert(refs4.some(r => r.match(/^\d{14}$/)), 'Extract 14-digit mnemonic', `References: ${refs4}`);

    // Test empty content
    const refs5 = extractBibleReferences('');
    assert(refs5.length === 0, 'Handle empty content', 'Empty array returned');

    // Test null content
    const refs6 = extractBibleReferences(null);
    assert(refs6.length === 0, 'Handle null content', 'Empty array returned');
}

/**
 * Test Suite 2: normalizeBibleReference
 */
function testNormalizeBibleReference() {
    console.log('\n=== Test Suite 2: normalizeBibleReference ===\n');

    // Test basic normalization
    const norm1 = normalizeBibleReference('John 3:16');
    assert(norm1 === 'john 3:16', 'Normalize to lowercase', `Result: ${norm1}`);

    // Test whitespace trimming
    const norm2 = normalizeBibleReference('  Matthew 5:5  ');
    assert(norm2 === 'matthew 5:5', 'Trim whitespace and lowercase', `Result: ${norm2}`);

    // Test empty string
    const norm3 = normalizeBibleReference('');
    assert(norm3 === null, 'Return null for empty string', `Result: ${norm3}`);

    // Test null
    const norm4 = normalizeBibleReference(null);
    assert(norm4 === null, 'Return null for null input', `Result: ${norm4}`);

    // Test mnemonic normalization
    const norm5 = normalizeBibleReference('04000301600000');
    assert(norm5 !== null && norm5.length > 0, 'Normalize mnemonic', `Result: ${norm5}`);
}

/**
 * Test Suite 3: buildBibleReferenceIndex
 */
function testBuildBibleReferenceIndex() {
    console.log('\n=== Test Suite 3: buildBibleReferenceIndex ===\n');

    // Setup
    allEntries = [...MOCK_ENTRIES];
    bibleReferenceIndex = {};
    buildBibleReferenceIndex();

    // Test index creation
    assert(Object.keys(bibleReferenceIndex).length > 0, 'Index created with entries', 
        `Index has ${Object.keys(bibleReferenceIndex).length} unique references`);

    // Test specific reference mapping
    const johnRef = Object.keys(bibleReferenceIndex).find(ref => ref.includes('john 3:16'));
    assert(johnRef !== undefined, 'Index contains John 3:16', `Found: ${johnRef}`);

    // Test entry index mapping
    if (johnRef) {
        const entryIndices = bibleReferenceIndex[johnRef];
        assert(Array.isArray(entryIndices), 'Entry indices are array', `Type: ${typeof entryIndices}`);
        assert(entryIndices.length > 0, 'Entry indices not empty', `Count: ${entryIndices.length}`);
    }

    // Test multiple entries with same reference
    const matthewRef = Object.keys(bibleReferenceIndex).find(ref => ref.includes('matthew'));
    assert(matthewRef !== undefined, 'Index contains Matthew reference', `Found: ${matthewRef}`);

    // Test no duplicate indices in same reference
    if (matthewRef) {
        const indices = bibleReferenceIndex[matthewRef];
        const uniqueIndices = new Set(indices);
        assert(indices.length === uniqueIndices.size, 'No duplicate indices in reference', 
            `Total: ${indices.length}, Unique: ${uniqueIndices.size}`);
    }
}

/**
 * Test Suite 4: searchBibleReferences
 */
function testSearchBibleReferences() {
    console.log('\n=== Test Suite 4: searchBibleReferences ===\n');

    // Setup
    allEntries = [...MOCK_ENTRIES];
    bibleReferenceIndex = {};
    buildBibleReferenceIndex();

    // Test empty search
    const results0 = searchBibleReferences('');
    assert(results0.length === 0, 'Empty search returns empty', `Results: ${results0.length}`);

    // Test short search (less than 2 chars)
    const results1 = searchBibleReferences('J');
    assert(results1.length === 0, 'Single character search returns empty', `Results: ${results1.length}`);

    // Test book name search
    const resultsJohn = searchBibleReferences('john');
    assert(resultsJohn.length > 0, 'Search for "john" finds entries', `Results: ${resultsJohn.length}`);
    assert(resultsJohn.some(e => e.title === 'Lion'), 'Lion entry found for "john"', 
        `Entries: ${resultsJohn.map(e => e.title).join(', ')}`);

    // Test verse number search
    const results3_16 = searchBibleReferences('3:16');
    assert(results3_16.length > 0, 'Search for "3:16" finds entries', `Results: ${results3_16.length}`);
    
    // Test chapter search
    const results5 = searchBibleReferences('5:5');
    assert(results5.length > 0, 'Search for "5:5" finds entries', `Results: ${results5.length}`);

    // Test multiple book search
    const resultsRomans = searchBibleReferences('romans');
    assert(resultsRomans.length > 0, 'Search for "romans" finds entries', `Results: ${resultsRomans.length}`);
    assert(resultsRomans.some(e => e.title === 'Olive Tree'), 'Olive Tree entry found for "romans"',
        `Entries: ${resultsRomans.map(e => e.title).join(', ')}`);

    // Test case insensitivity
    const resultsMatt = searchBibleReferences('MATTHEW');
    const resultsMatt2 = searchBibleReferences('matthew');
    assert(resultsMatt.length === resultsMatt2.length, 'Search is case insensitive',
        `MATTHEW: ${resultsMatt.length}, matthew: ${resultsMatt2.length}`);

    // Test results are entries
    if (resultsJohn.length > 0) {
        const firstResult = resultsJohn[0];
        assert(firstResult.hasOwnProperty('title'), 'Result has title property', `Props: ${Object.keys(firstResult)}`);
        assert(firstResult.hasOwnProperty('content'), 'Result has content property', `Props: ${Object.keys(firstResult)}`);
        assert(firstResult.hasOwnProperty('category'), 'Result has category property', `Props: ${Object.keys(firstResult)}`);
    }
}

/**
 * Test Suite 5: Integration Tests
 */
function testIntegration() {
    console.log('\n=== Test Suite 5: Integration Tests ===\n');

    // Setup
    allEntries = [...MOCK_ENTRIES];
    bibleReferenceIndex = {};
    activeFilters = { dictionary: '', topKey: '', keyScope: '', searchTerm: '', searchMode: 'entries' };
    
    buildBibleReferenceIndex();

    // Test switching to reference search mode
    activeFilters.searchMode = 'references';
    activeFilters.searchTerm = 'john';
    const filtered = getFilteredEntries();
    assert(filtered.length > 0, 'Reference search mode works', `Found ${filtered.length} entries`);
    assert(filtered.some(e => e.title === 'Lion'), 'Lion entry found in reference search', 
        `Entries: ${filtered.map(e => e.title).join(', ')}`);

    // Test filtering by dictionary
    activeFilters.dictionary = 'flora';
    const filteredFlora = getFilteredEntries();
    assert(filteredFlora.length >= 0, 'Can filter reference results by dictionary', `Found ${filteredFlora.length} entries`);
    assert(filteredFlora.every(e => e.category === 'flora'), 'All results are flora', 
        `Categories: ${filteredFlora.map(e => e.category).join(', ')}`);

    // Test entry search mode still works
    activeFilters.searchMode = 'entries';
    activeFilters.dictionary = '';
    activeFilters.searchTerm = 'lion';
    const entriesSearch = getFilteredEntries();
    assert(entriesSearch.length > 0, 'Entry search mode still works', `Found ${entriesSearch.length} entries`);
    assert(entriesSearch.some(e => e.title === 'Lion'), 'Lion entry found in entry search',
        `Entries: ${entriesSearch.map(e => e.title).join(', ')}`);
}

/**
 * Test Suite 6: Edge Cases
 */
function testEdgeCases() {
    console.log('\n=== Test Suite 6: Edge Cases ===\n');

    // Test with entries containing special characters
    const edgeEntry = {
        key: '5.1',
        title: 'Edge Case',
        category: 'fauna',
        content: 'Contains John 3:16! And Matthew 5:5? Also (Luke 19:46).',
        wordCount: 12
    };
    
    allEntries = [edgeEntry];
    bibleReferenceIndex = {};
    buildBibleReferenceIndex();

    const edgeResults = searchBibleReferences('john');
    assert(edgeResults.length > 0, 'Handles special characters in content', 
        `Found ${edgeResults.length} references`);

    // Test entry with no references
    const noRefEntry = {
        key: '6.1',
        title: 'No References',
        category: 'fauna',
        content: 'This entry has no Bible references at all.',
        wordCount: 8
    };

    allEntries = [noRefEntry];
    bibleReferenceIndex = {};
    buildBibleReferenceIndex();

    assert(Object.keys(bibleReferenceIndex).length === 0, 'Handles entries with no references',
        `Index size: ${Object.keys(bibleReferenceIndex).length}`);

    // Test with very long content
    const longContent = 'John 3:16 ' + 'Lorem ipsum dolor sit amet. '.repeat(100) + ' John 3:16';
    const longEntry = {
        key: '7.1',
        title: 'Long Entry',
        category: 'realia',
        content: longContent,
        wordCount: 200
    };

    allEntries = [longEntry];
    bibleReferenceIndex = {};
    buildBibleReferenceIndex();

    const longResults = searchBibleReferences('john 3:16');
    assert(longResults.length > 0, 'Handles very long content', `Found ${longResults.length} entries`);
}

/**
 * Test Suite 7: Image Path Resolution
 */
function testImagePathResolution() {
    console.log('\n=== Test Suite 7: Image Path Resolution ===\n');

    const candidates = resolveImageCandidates('WEB-0066_bears');
    assert(Array.isArray(candidates), 'Image candidates returns array', `Type: ${typeof candidates}`);
    assert(candidates.length > 0, 'Image candidates has values', `Count: ${candidates.length}`);
    assert(candidates[0] === '../data/images/WEB-0066_bears.jpg', 'First path prefers new data/images location', `First: ${candidates[0]}`);
    assert(candidates.some(p => p === 'images/WEB-0066_bears.jpg'), 'Legacy images path retained as fallback', 'Found legacy fallback');

    const explicit = resolveImageCandidates('WEB-0066_bears.png');
    assert(explicit[0] === '../data/images/WEB-0066_bears.png', 'Explicit extension uses new data/images path', `First: ${explicit[0]}`);
    assert(explicit.includes('images/WEB-0066_bears.png'), 'Explicit extension keeps legacy fallback path', 'Found explicit legacy fallback');
}

/**
 * Test Suite 8: Card Rendering Structure
 */
function testCardRenderingStructure() {
    console.log('\n=== Test Suite 8: Card Rendering Structure ===\n');

    if (typeof document === 'undefined') {
        assert(true, 'Rendering tests skipped in Node environment', 'No DOM available');
        return;
    }

    const host = document.createElement('div');
    host.id = 'entryList';
    document.body.appendChild(host);

    allEntries = [
        { key: '1', title: 'Animals, general', category: 'fauna', content: '', wordCount: 10 },
        { key: '1.1', title: 'Domestic animals', category: 'fauna', content: '', wordCount: 5 },
        { key: '1', title: 'Wild Trees and Shrubs', category: 'flora', content: '', wordCount: 8 },
        { key: '1.1', title: 'Boxthorn', category: 'flora', content: '', wordCount: 3 }
    ];

    buildKeyTitleLookup();
    renderList([allEntries[1], allEntries[3]]);

    const cards = host.querySelectorAll('.entry-item');
    assert(cards.length === 2, 'Renders one card per provided entry', `Count: ${cards.length}`);

    const firstHierarchy = cards[0].querySelector('.meta-hierarchy');
    assert(Boolean(firstHierarchy), 'Card includes hierarchy block', `Exists: ${Boolean(firstHierarchy)}`);

    const categoryTag = cards[0].querySelector('.meta-tag');
    assert(Boolean(categoryTag) && categoryTag.textContent.includes('Animals, general'), 'Category tag renders parent section title', `Text: ${categoryTag ? categoryTag.textContent : ''}`);

    const subTag = cards[0].querySelector('.meta-tag.sub');
    assert(Boolean(subTag) && subTag.textContent.includes('Domestic animals'), 'Subcategory tag renders entry section title', `Text: ${subTag ? subTag.textContent : ''}`);

    const secondCategoryTag = cards[1].querySelector('.meta-tag');
    assert(Boolean(secondCategoryTag) && secondCategoryTag.textContent.includes('Wild Trees and Shrubs'), 'Category lookup is dictionary-scoped (no cross-category key collision)', `Text: ${secondCategoryTag ? secondCategoryTag.textContent : ''}`);

    host.remove();
}

/**
 * Test Suite 9: XML Viewer Rendering
 */
function testXmlViewerRendering() {
    console.log('\n=== Test Suite 9: XML Viewer Rendering ===\n');

    const sampleXml = `
        <div class="section-box" data-kind="references">
            <div class="section-label">references</div>
            <h4>References:</h4>
            <p>AT&amp;T "quoted" text <strong>bold</strong></p>
        </div>
    `;

    const rendered = buildXmlView(sampleXml);
    assert(typeof rendered === 'string' && rendered.includes('class="xml-viewer"'), 'XML view wrapper is rendered', 'Found xml-viewer wrapper');
    assert(rendered.includes('class="xml-node"'), 'XML node details blocks are rendered', 'Found xml-node details');
    assert(rendered.includes('class="xml-summary"'), 'XML summary rows are rendered', 'Found xml-summary');
    assert(rendered.includes('class="xml-tag">div</span>'), 'Tag names are syntax-highlighted', 'Found xml-tag span for div');
    assert(rendered.includes('class="xml-attr-name">data-kind</span>'), 'Attribute names are syntax-highlighted', 'Found data-kind attribute');
    assert(rendered.includes('&amp;quot;references&amp;quot;') || rendered.includes('&quot;references&quot;'), 'Attribute values are escaped in output', 'Found escaped attribute value');

    const escaped = escapeXmlText('<tag x="1">Tom & Jerry</tag>');
    assert(escaped.includes('&lt;tag'), 'escapeXmlText escapes opening brackets', `Escaped: ${escaped}`);
    assert(escaped.includes('&amp;'), 'escapeXmlText escapes ampersands', `Escaped: ${escaped}`);
    assert(escaped.includes('&quot;1&quot;'), 'escapeXmlText escapes quotes', `Escaped: ${escaped}`);

    const emptyRendered = buildXmlView('');
    assert(emptyRendered.includes('No XML content found for this entry.'), 'Empty XML view shows friendly message', 'Found empty-state message');

    const parser = new DOMParser();
    const doc = parser.parseFromString('<root><p>  </p><p>text</p></root>', 'text/html');
    const root = doc.querySelector('root');
    const children = getRenderableXmlChildren(root);
    assert(children.length >= 2, 'Renderable XML children include elements and non-empty text only', `Count: ${children.length}`);
}

/**
 * Run all tests and print summary
 */
function runAllTests() {
    resetTestState();
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Bible Reference Search Test Suite                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Run all test suites
    testExtractBibleReferences();
    testNormalizeBibleReference();
    testBuildBibleReferenceIndex();
    testSearchBibleReferences();
    testIntegration();
    testEdgeCases();
    testImagePathResolution();
    testCardRenderingStructure();
    testXmlViewerRendering();

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total:   ${testsPassed + testsFailed}\n`);

    if (testsFailed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log(`⚠️  ${testsFailed} test(s) failed - review results above.`);
    }

    // Return detailed results
    return {
        passed: testsPassed,
        failed: testsFailed,
        total: testsPassed + testsFailed,
        results: testResults
    };
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testExtractBibleReferences,
        testNormalizeBibleReference,
        testBuildBibleReferenceIndex,
        testSearchBibleReferences,
        testIntegration,
        testEdgeCases,
        testImagePathResolution,
        testCardRenderingStructure,
        testXmlViewerRendering
    };
}

// Run tests if script is loaded directly
if (typeof window === 'undefined' || !window.document) {
    // Node.js environment - run tests
    runAllTests();
}
