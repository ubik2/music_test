import { IndexPage } from "./indexpage";

function setupIndexPage() {
    const indexPage = new IndexPage();
    indexPage.setupIndexPage();
}

window.setupIndexPage = setupIndexPage;