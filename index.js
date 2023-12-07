const puppeteer = require('puppeteer');
const fs = require("fs");

// These are class names of some of the specific elements in these cards
const SELECTORS = {
    NAME: '.DUwDvf.lfPIob',
    LISTING: 'a[href^="https://www.google.com/maps/place/',
    RATINGS: '.F7nice',
    PRICE: '.wcldff.fontHeadlineSmall.Cbys4b',
    LINK: '.hfpxzc',
    IMAGE: '.p0Hhde.FQ2IWe',
    NAV_BUTTONS: '.TQbB2b',
    LIST_ITEM: '.Nv2PK.THOPZb.CpccDe', // select 'a' tag for click
    EXPANDED_LIST_ITEM: '.bJzME.Hu9e2e.tTVLSc',
    CATEGORY: '.DkEaL',
    ADDRESS_ICON: 'img[src*="place"][class="Liguzb"]',
    WEBSITE_ICON: 'img[src*="public"][class="Liguzb"]',
    PHONE_ICON: 'img[src*="phone"][class="Liguzb"]',
    CLOSE: '.VfPpkd-icon-LgbsSe.yHy1rc.eT1oJ.mN1ivc'
};

// Scrapes the data from the page
const getData = async (page) => {
    const result = [];
    const listItems = await page.$$(SELECTORS.LIST_ITEM + ' > a');
    let index = 0;
    for (const listItem of listItems) {
        await listItem.click();
        await page.waitForSelector(SELECTORS.EXPANDED_LIST_ITEM);
        await page.waitForTimeout(2000);
        const data = await page.evaluate((opts) => {
            const { selectors: SELECTORS, index } = opts;
            return {
                name: (document.querySelectorAll(SELECTORS.NAME)[0]?.textContent || '').trim(),
                rating: (document.querySelectorAll(SELECTORS.RATINGS)[0]?.textContent || '').trim(),
                category: (document.querySelectorAll(SELECTORS.CATEGORY)[0]?.textContent || '').trim(),
                address: (document.querySelectorAll(SELECTORS.ADDRESS_ICON)[0]?.parentNode.parentNode.nextSibling.querySelector('.Io6YTe.fontBodyMedium.kR99db').textContent || ''),
                website: (document.querySelectorAll(SELECTORS.WEBSITE_ICON)[0]?.parentNode.parentNode.nextSibling.querySelector('.Io6YTe.fontBodyMedium.kR99db').textContent || ''),
                phone: (document.querySelectorAll(SELECTORS.PHONE_ICON)[0]?.parentNode.parentNode.nextSibling.querySelector('.Io6YTe.fontBodyMedium.kR99db').textContent || ''),
                //price: (document.querySelectorAll(SELECTORS.PRICE)[0]?.textContent || '').trim(),
                link: (document.querySelectorAll(SELECTORS.LINK)[index]?.href || ''),
                //image: (document.querySelectorAll(SELECTORS.IMAGE)[0]?.children[0].src || '')
            };
        }, { selectors: SELECTORS, index });
        index++;
        result.push(data);
        await page.click(SELECTORS.CLOSE);
        await page.waitForTimeout(500);
    }
    return result;
}

// Scrolls till the end of the page
const scrollTillTheEnd = async (page) => {
    let endOfPage = false;
    let count = 0;
    do {
        const { _count, _endOfPage } = await page.evaluate((opts) => {
            const { selectors: SELECTORS, count } = opts;
            const allListings = document.querySelectorAll(SELECTORS.LISTING);
            const newItemsCount = (allListings ? allListings.length : 0) - count;

            if (allListings && allListings.length) {
                allListings[allListings.length - 1].scrollIntoView();
            }

            const _endOfPage = newItemsCount > 0;

            return {
                _count: allListings.length,
                _endOfPage
            };
        }, { selectors: SELECTORS, count });

        count = _count;
        endOfPage = _endOfPage;

        await page.waitForTimeout(3000);
    } while (endOfPage);
}

(async () => {
    try {
        browser = await puppeteer.launch({ headless: false });;
        const page = await browser.newPage();

        await page.setViewport({ width: 1440, height: 789 });

        // Visit maps.google.com
        await page.goto('https://maps.google.com');

        // Wait till the page loads and an input field
        // with id searchboxinput is also present
        await page.waitForSelector('#searchboxinput');
        // Simulate user click
        await page.click('#searchboxinput');

        // Type our search query
        await page.type('#searchboxinput', "marriage resorts near pune nagar highway");
        // Simulate pressing Enter key
        await page.keyboard.press('Enter');

        // Wait for the page to load results.
        await page.waitForSelector(SELECTORS.LISTING);

        await scrollTillTheEnd(page);

        const finalData = await getData(page);

        fs.writeFileSync("final.json", JSON.stringify(finalData));
        console.log("Final data", finalData.length);

        browser.close();
        console.log(`Completed with ${finalData.length} results`);
        // console.log(finalData);""

    } catch (error) {
        browser.close();
        console.log(error);
    }
})();