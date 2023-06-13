import { Browser, Page } from 'puppeteer';
import AutomationTestSetup from '../../bootstrap/automationSetup';
import fs from 'fs';

interface IPosts {
    title: string;
    content: string;
    date?: string;
}

class ExampleSpec extends AutomationTestSetup {
    constructor(page: Page, browser: Browser) {
        super();
        this.assert(page);
    }

    async assert(page: Page) {
        try {
            await this.downloadPosts(page);
        } catch (error) {
            console.log(error);
            fs.writeFile('log.txt', JSON.stringify(error), (err) => {
                if (err) {
                    console.error('An error occurred while writing to the file:', err);
                    return;
                }

                console.log('Content has been written to the file successfully.');
            });
        }
    }

    async downloadPosts(page: Page): Promise<void> {
        const postsQuantity = await this.postsQuantity(page);
        let idx = 0;
        if (postsQuantity > 0) {
            while (idx < postsQuantity) {
                console.log(`Baixando postagem ${idx + 1}`);
                const posts = await page.waitForSelector(`#ultimas_ul.list-group`);
                await posts?.evaluate((el, index) => {
                    const post = el.children[index];
                    (post as HTMLAnchorElement).click();
                }, idx);
                const entryContent = await page.waitForSelector('#textos');
                const postContent = await entryContent?.evaluate((data) => {
                    let postContent: IPosts = { title: '', content: '' };
                    const title = data.querySelector('h3') as HTMLDivElement;
                    postContent.title = title.innerText;
                    title.remove();
                    postContent.content = data.innerHTML;
                    return postContent;
                });
                await this.upsertData(postContent);
                await page.goBack();
                idx++;
            }
        }
    }

    async upsertData(data?: IPosts) {
        if (!fs.existsSync('data.json')) {
            fs.writeFileSync('data.json', JSON.stringify({ posts: [] }));
        }
        const storedData = JSON.parse(fs.readFileSync('data.json', 'utf8')) as { posts: IPosts[] };

        if (data) {
            const newData: { posts: IPosts[] } = {
                posts: [...storedData.posts, data],
            };
            fs.writeFileSync('data.json', JSON.stringify(newData), 'utf8');
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    async postsQuantity(page: Page): Promise<number> {
        const findPosts = await page.waitForSelector('#ultimas_ul.list-group');

        const result = await findPosts?.evaluate((el) => {
            const materias = el.childNodes;
            return materias.length;
        });

        return result ?? 0;
    }

    async getCurrentPage(page: Page) {
        let currentPage = await page.waitForSelector('ul.pagination li.active');
        let pageNumber = await currentPage?.evaluate((el) => el.innerText);
        return parseInt(pageNumber as string) ?? 1;
    }

    async setPage(page: Page, num: number) {
        let pagination = await page.waitForSelector(`ul.pagination li.page-away-${num - 1} a`);
        pagination?.evaluate((el) => {
            el?.click();
        });
    }
}

export default ExampleSpec;
