I ran into some issues resolving module dependencies on the local filesystem, since chrome really doesn't like that.
To work around this, I added npm and the http-server module, so I can run a local server and serve files from there.
I don't check in the node_modules folder, but this can be created based on the package.json (or package-lock.json) file. For a new checkout, run "npm install". You'll need npm to be able to do that, which you can download as part of the node.js package from https://nodejs.org/en/

I investigated webpack, but for now, I'm not actually using it. I did add the config file I was using, in case I change my mind. I also still have the "npm run-script build" option included in package.json.
I included the jest package, but I haven't written any tests.

I have Tone.js checked in directly, but this is not my code, and the ISC license is not intended to apply to it. That package is distributed under the MIT license.