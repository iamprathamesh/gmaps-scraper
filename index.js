const puppeteer = require('puppeteer');
const fs = require("fs");

// These are class names of some of the specific elements in these cards
const SELECTORS = {
    NAME: '.qBF1Pd.fontHeadlineSmall',
    LISTING: 'a[href^="https://www.google.com/maps/place/',
    RATINGS: '.ZkP5Je',
    PRICE: '.wcldff.fontHeadlineSmall.Cbys4b',
    LINK: '.hfpxzc',
    IMAGE: '.p0Hhde.FQ2IWe',
    NAV_BUTTONS: '.TQbB2b',
};

// Scrapes the data from the page
const getData = async (page, currentPageNum) => {
    return await page.evaluate((opts) => {
        const { selectors: SELECTORS } = opts;

        const elements = document.querySelectorAll(SELECTORS.LISTING);
        const placesElements = Array.from(elements).map(element => element.parentElement);

        const places = placesElements.map((place, index) => {
            // Getting the names
            const name = (place.querySelector(SELECTORS.NAME)?.textContent || '').trim();
            const rating = (place.querySelector(SELECTORS.RATINGS)?.textContent || '').trim();
            const price = (place.querySelector(SELECTORS.PRICE)?.textContent || '').trim();
            const link = (place.querySelector(SELECTORS.LINK)?.href || '');
            const image = (place.querySelector(SELECTORS.IMAGE)?.children[0].src || '');

            return { name, rating, price, link, image };
        })

        return places;
    }, { selectors: SELECTORS, currentPageNum });
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

// Emulates pagination
const nextPage = async (page, currentPageNum) => {
    const endReached = await page.evaluate(async (opts) => {
        return new Promise(async (resolve) => {
            const { SELECTORS, currentPageNum, MAX_PAGE_COUNT } = opts;
            const navButtons = document.querySelectorAll(SELECTORS.NAV_BUTTONS);
            // const preButton = navButtons[0].parentElement;
            const nextButton = navButtons[1].parentElement;

            if (nextButton.disabled) {
                return resolve(true);
            }

            // This is our on purpose condition, just for the sake of this article
            if (currentPageNum === MAX_PAGE_COUNT) {
                return resolve(true);
            }

            nextButton.click();
            return resolve(false);
        });
    }, { SELECTORS, currentPageNum, MAX_PAGE_COUNT });

    if (endReached) {
        return false;
    }

    try {
        await page.waitForTimeout(3000);
    } catch (error) {
        // Ignoring this error
        console.log(error);
    }

    return true;
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
        await page.type('#searchboxinput', "Hotels in dublin, Ireland");
        // Simulate pressing Enter key
        await page.keyboard.press('Enter');

        // Wait for the page to load results.
        await page.waitForSelector(SELECTORS.LISTING);

        let finalData = [];
        let currentPageNum = 0;

        // modified this to false for only 1 page result
        let moreAvailable = false;

        do {
            await scrollTillTheEnd(page);

            const pageData = await getData(page, currentPageNum);

            if (pageData.length === 0) {
                moreAvailable = false;
            }

            finalData = finalData.concat(pageData);

            if (moreAvailable) {
                currentPageNum = currentPageNum + 1;
                moreAvailable = await nextPage(page, currentPageNum);
            }

        } while (moreAvailable);

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