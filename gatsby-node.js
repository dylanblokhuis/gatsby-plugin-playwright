const handler = require('serve-handler');
const http = require('http');
const playwright = require('playwright');
const fs = require('fs');

const publicPath = './public';

const defaultOptions = {
  port: 9000,
  screenshotsDir: './screenshots',
  browsers: ['chromium', 'firefox', 'webkit'],
  context: {},
  query: `
    {
      allSitePage {
        nodes {
          path
        }
      }
    }
  `,
  serialize: function ({ allSitePage }) {
    return allSitePage.nodes.map((page) => page.path);
  }
}

exports.onPostBuild = async ({ graphql }, pluginOptions) => {
  const { port, screenshotsDir, browsers, context, query, serialize } = {
    ...defaultOptions,
    ...pluginOptions
  }

  const { data } = await graphql(query)
  const paths = serialize(data);

  const server = http.createServer((request, response) => {
    const config = {
      public: publicPath
    }

    return handler(request, response, config);
  })
  await server.listen(port);

  for (const browserType of browsers) {
    if (!playwright[browserType]) {
      console.error(`gatsby-plugin-playwright: Browser ${browserType} is not supported`)
      return;
    }

    const browser = await playwright[browserType].launch();
    const browserContext = await browser.newContext(context);
    const page = await browserContext.newPage();

    if (!fs.existsSync(screenshotsDir)){
      fs.mkdirSync(screenshotsDir);
    }

    if (!fs.existsSync(`${screenshotsDir}/${browserType}`)){
      fs.mkdirSync(`${screenshotsDir}/${browserType}`);
    }

    for (const path of paths) {
      // removes forward slashes
      let fileName = path.replace(/\\|\//g, '');
      if (fileName === "") fileName = "home";

      const screenshotPath = `${screenshotsDir}/${browserType}/${fileName}.png`
      await page.goto(`http://localhost:${port}${path}`);
      await page.screenshot({ path: screenshotPath });
      console.log(`gatsby-plugin-playwright:`, screenshotPath)
    }

    await browser.close();
  }

  await server.close();
}
