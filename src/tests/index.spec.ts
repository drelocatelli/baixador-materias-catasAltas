import { Browser, Page } from "puppeteer";
import AutomationTestSetup from "../../bootstrap/automationSetup";
import fs from "fs";

interface IPosts {
  id?: string;
  title?: string;
  content?: string;
  date?: string;
  url?: string;
}

class ExampleSpec extends AutomationTestSetup {
  pageNumber: number = 0;
  page: Page;
  browser: Browser;

  constructor(page: Page, browser: Browser) {
    super();
    this.page = page;
    this.browser = browser;

    if (fs.existsSync("data.json")) {
      fs.unlinkSync("data.json");
    }

    this.assert();
  }

  async nextPage() {
    this.pageNumber++;
    await this.page.waitForTimeout(500);

    //@ts-ignore
    await this.page.evaluate((pageNumber: any) => {
      console.log("Load Ultimas: ", pageNumber);
      (window as any).Load_Ultimas(pageNumber);
    }, this.pageNumber);

    await this.page.waitForTimeout(
      process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : 1000
    );

    this.assert();
  }

  async assert() {
    try {
      await this.downloadPosts(this.page);
    } catch (error) {
      console.log(error);
      fs.writeFile("log.txt", JSON.stringify(error), (err) => {
        if (err) {
          console.error("An error occurred while writing to the file:", err);
          return;
        }

        console.log("Content has been written to the file successfully.");
      });
    }
  }

  async downloadPosts(page: Page): Promise<void> {
    const listGroup = await page.waitForSelector(`#ultimas_ul.list-group`);
    let posts: any = [];

    posts = await listGroup?.evaluate((el) => {
      const listGroupItems: NodeListOf<HTMLAnchorElement> =
        document.querySelectorAll("#ultimas_ul.list-group > .list-group-item");
      let items: string[] = [];

      for (let item of listGroupItems) {
        items.push(item.href);
      }

      return items;
    });

    if (!posts?.length) {
      return;
    }

    console.log(`Baixando postagens da página ${this.pageNumber + 1}...`);

    let pageMateria: Page = await page.browser().newPage();

    for await (let post of posts) {
      console.log(`Acessando: ${post}`);
      await pageMateria.goto(post);
      await pageMateria.waitForTimeout(
        process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : 800
      );
      const entryContent = await pageMateria.waitForSelector("#textos");
      const postContent = await entryContent?.evaluate((data) => {
        let postContent: IPosts = {};
        const title = data.querySelector("h3") as HTMLDivElement;
        postContent.title = title.innerText.trim();
        const date = data.querySelector(".dt_materia") as HTMLParagraphElement;
        postContent.date = date.innerText.trim();
        const subtitle = data.querySelector(".ds_chamada") as HTMLDivElement;
        subtitle.remove();
        title.remove();
        date.remove();
        postContent.id = window.location.href.split("/").pop();
        postContent.url = window.location.href;
        postContent.content = data.innerHTML.trim();
        return postContent;
      });

      await this.upsertData(postContent);
    }

    await pageMateria.close();
    await this.nextPage();
  }

  async upsertData(data?: IPosts) {
    if (!fs.existsSync("data.json")) {
      fs.writeFileSync("data.json", JSON.stringify({ posts: [] }));
    }

    console.log(`Baixando: ${data?.title}`);
    const storedData = JSON.parse(fs.readFileSync("data.json", "utf8")) as {
      posts: IPosts[];
    };

    if (data) {
      const newData: { posts: IPosts[] } = {
        posts: [...storedData.posts, data],
      };
      fs.writeFileSync("data.json", JSON.stringify(newData, null, 2), "utf8");
    }

    console.log("Tudo ok!");

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  async getCurrentPage(page: Page) {
    let currentPage = await page.waitForSelector("ul.pagination li.active");
    let pageNumber = await currentPage?.evaluate((el) => el.innerText);
    return parseInt(pageNumber as string) ?? 1;
  }

  async setPage(page: Page, num: number) {
    let pagination = await page.waitForSelector(
      `ul.pagination li.page-away-${num - 1} a`
    );
    pagination?.evaluate((el) => {
      el?.click();
    });
  }
}

export default ExampleSpec;
