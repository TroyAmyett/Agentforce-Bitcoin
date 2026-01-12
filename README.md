# Salesforce DX Project: Next Steps

Now that you’ve created a Salesforce DX project, what’s next? Here are some documentation resources to get you started.

## How Do You Plan to Deploy Your Changes?

Do you want to deploy a set of changes, or create a self-contained application? Choose a [development model](https://developer.salesforce.com/tools/vscode/en/user-guide/development-models).

## Configure Your Salesforce DX Project

The `sfdx-project.json` file contains useful configuration information for your project. See [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_ for details about this file.

## Salesforce CLI Setup

If you encounter issues with the `sf` command not being recognized in VS Code terminal after reinstalling the Salesforce CLI, follow these steps:

1. **Verify Installation Path**: The CLI is installed at `C:\Program Files\sf\bin`.
2. **Update PATH Environment Variable**:
   - Open Windows "Environment Variables" settings.
   - Under "System Variables", find and select `Path`, then click `Edit`.
   - Add `C:\Program Files\sf\bin` to the list (ensure it's at the beginning or after other CLI paths).
   - Click OK to save changes.
3. **Restart VS Code**: Close and reopen VS Code to reload the environment.
4. **Test in Terminal**:
   - Open a new VS Code terminal (`Ctrl + Shift + `` `).
   - Run `sf --version` to verify it works.

## Read All About It

- [Salesforce Extensions Documentation](https://developer.salesforce.com/tools/vscode/)
- [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm)
- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference.htm)
