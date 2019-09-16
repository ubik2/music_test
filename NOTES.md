I ran into some issues resolving module dependencies on the local filesystem, since chrome really doesn't like that.
To work around this, I added npm and the http-server module, so I can run a local server and serve files from there.
I don't check in the node_modules folder, but this can be created based on the package.json (or package-lock.json) file. For a new checkout, run "npm install". You'll need npm to be able to do that, which you can download as part of the node.js package from https://nodejs.org/en/

I investigated webpack, but for now, I'm not actually using it. I did add the config file I was using, in case I change my mind. I also still have the "npm run-script build" option included in package.json.
I included the jest package, but I haven't written many tests.

I added SF2 support, but I'm not properly handling all the modulators. There are 10 default modulators that should be set up. I'm handling the first two of them (the others use MIDI inputs that I don't provide)

The SF2 spec includes presets, which should be used to switch which set of samples I use to play different keys. I'm not currently doing this, and am basing all audio on a pitch shifted version of C4. The sound font I'm using has poor quality down below G3, but we don't use any of those.

