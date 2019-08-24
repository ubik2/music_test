import { IndexPage } from "./indexpage";

let indexPage = null;
function setupIndexPage() {
    indexPage = new IndexPage();
    indexPage.setupIndexPage();
    window.indexPage = indexPage;
}

window.onload = setupIndexPage;
