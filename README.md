# PassHub.net extension for Firefox

The extension is a form-filler for [PassHub.net](https://passhub.net) password manager.

## How to compile

To build the extension, use the `npm` tool

```sh
npm install
npm run build
```

The output files are placed into the root directory of the project

The extension file list includes:

```
/fonts
/images
background.js
contentScript.js
index.css
login.css
manifest.json
popup.html
popup.js
```

## How to use

### Create PassHub account

To use the extension, first create a PassHub.net account, if you do not have one:

- install the WWPass Key app on a smartphone
- go to the PassHub.net website and scan a QR code with the WWPass Key app
- add credentials of your accounts on websites, e.g., put your GitHub username, password, and a link to the GitHub login page: [https://github.com/login](https://github.com/login)

For detailed instructions see the PassHub.net [documentation](https://pashub.net/doc/).

### Login to PassHub extension

In Firefox, you click the PassHub extension icon in the upper right corner and scan the dynamic QR code to get access to your data.

![Extension Login](/doc/ext_login.png).

### Login form fill

Now you can open the GitHub login page [https://github.com/login](https://github.com/login) and click the extension icon. You will be presented with a choice of found accounts for the site.

![Account selection for the current web page](/doc/ext1.png).

Click on the account of your choice, its credentials will be placed into the login form

![Form-fill](/doc/ext_form_filled.png)

### Extension sign out

At any moment, click the `Logout` link to sign out

![Sign out](/doc/ext_logout.png)
