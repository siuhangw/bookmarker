---
title: "ChrisTitusTech/winutil: Chris Titus Tech's Windows Utility - Install Programs, Tweaks, Fixes, and Updates"
url: "https://github.com/christitustech/winutil"
description: "Chris Titus Tech's Windows Utility - Install Programs, Tweaks, Fixes, and Updates - ChrisTitusTech/winutil"
collection: "tools"
subcollection:
tags:
featured:
added: "2026-04-25T20:48:35+08:00"
---
## Chris Titus Tech's Windows Utility

This utility is a compilation of Windows tasks I perform on each Windows system I use. It is meant to streamline *installs*, debloat with *tweaks*, troubleshoot with *config*, and fix Windows *updates*. I am extremely picky about any contributions to keep this project clean and efficient.

[![screen-install](https://github.com/ChrisTitusTech/winutil/raw/main/docs/assets/images/Title-Screen.png)](https://github.com/ChrisTitusTech/winutil/blob/main/docs/assets/images/Title-Screen.png)

## 💡 Usage

Winutil must be run in Admin mode because it performs system-wide tweaks. To achieve this, run PowerShell as an administrator. Here are a few ways to do it:

1. **Start menu Method:**
	- Right-click on the start menu.
		- Choose "Windows PowerShell (Admin)" (for Windows 10) or "Terminal (Admin)" (for Windows 11).
2. **Search and Launch Method:**
	- Press the Windows key.
		- Type "PowerShell" or "Terminal" (for Windows 11).
		- Press `Ctrl + Shift + Enter` or Right-click and choose "Run as administrator" to launch it with administrator privileges.

### Launch Command

```
irm "https://christitus.com/win" | iex
```

#### Dev Branch

```
irm "https://christitus.com/windev" | iex
```

If you have Issues, refer to [Known Issues](https://winutil.christitus.com/knownissues/) or [Create Issue](https://github.com/ChrisTitusTech/winutil/issues)

## 🎓 Documentation

### WinUtil Official Documentation

### YouTube Tutorial

### ChrisTitus.com Article

## 🛠️ Build & Develop

> [!note] Note
> Winutil is a relatively large script, so it's split into multiple files which're combined into a single `.ps1` file using a custom compiler. This makes maintaining the project a lot easier.

Get a copy of the source code. This can be done using GitHub UI (**Code** > **Download ZIP**), or by cloning (downloading) the repo using git.

If git is installed, run the following commands under a PowerShell window to clone and move into the project's directory:

```
git clone --depth 1 "https://github.com/ChrisTitusTech/winutil.git"
cd winutil
```

To build the project, run the Compile Script under a PowerShell window (admin permissions IS NOT required):

```
.\Compile.ps1
```

You'll see a new file named `winutil.ps1`, which was created by `Compile.ps1` script. Now you can run it as admin, and a new window will pop up. Enjoy your own compiled version of WinUtil:)

> [!tip] Tip
> For more info on using WinUtil and how to develop for it, please consider reading [the Contribution Guidelines](https://winutil.christitus.com/contributing/). If you don't know where to start, or have questions, you can ask over on our [Discord Community Server](https://discord.gg/RUbZUZyByQ), and active project members will answer when they can.

## 💖 Support

- To morally and mentally support the project, make sure to leave a ⭐️!
- EXE Wrapper for $10 @ [https://www.cttstore.com/windows-toolbox](https://www.cttstore.com/windows-toolbox)

## 💖 Sponsors

These are the sponsors that help keep this project alive with monthly contributions.

[![User avatar: ](https://github.com/dwelfusius.png)](https://github.com/dwelfusius) [![User avatar: Martin Stockzell](https://github.com/mews-se.png)](https://github.com/mews-se) [![User avatar: Jason A. Diegmueller](https://github.com/jdiegmueller.png)](https://github.com/jdiegmueller) [![User avatar: RMS](https://github.com/robertsandrock.png)](https://github.com/robertsandrock) [![User avatar: Paul](https://github.com/paulsheets.png)](https://github.com/paulsheets) [![User avatar: Dave J  (WhamGeek)](https://github.com/djones369.png)](https://github.com/djones369) [![User avatar: Anthony Mendez](https://github.com/anthonymendez.png)](https://github.com/anthonymendez) [![User avatar: ](https://github.com/FatBastard0.png)](https://github.com/FatBastard0) [![User avatar: DursleyGuy](https://github.com/DursleyGuy.png)](https://github.com/DursleyGuy) [![User avatar: ](https://github.com/DwayneTheRockLobster1.png)](https://github.com/DwayneTheRockLobster1) [![User avatar: Kiera Meredith](https://github.com/KieraKujisawa.png)](https://github.com/KieraKujisawa) [![User avatar: Miguel Diaz](https://github.com/partybrasil.png)](https://github.com/partybrasil) [![User avatar: Andrew P](https://github.com/andrewpayne68.png)](https://github.com/andrewpayne68) [![User avatar: Di3Z1E](https://github.com/Di3Z1E.png)](https://github.com/Di3Z1E) [![User avatar: Abdul Vakeel Software Engineer](https://github.com/AbdulVakeel.png)](https://github.com/AbdulVakeel)

## 🏅 Thanks to all Contributors

Thanks a lot for spending your time helping Winutil grow. Thanks a lot! Keep rocking 🍻.

[![Contributors](https://camo.githubusercontent.com/16b91eb12ec0078b5b15e8406c5c2cbee2bb761ef93b5e0029f73ff2704c3b79/68747470733a2f2f636f6e747269622e726f636b732f696d6167653f7265706f3d43687269735469747573546563682f77696e7574696c)](https://github.com/ChrisTitusTech/winutil/graphs/contributors)

[![Alt](https://camo.githubusercontent.com/1810532add46b40130a22675b6357d78c28817ef86638ecea5825483d1be368c/68747470733a2f2f7265706f62656174732e6178696f6d2e636f2f6170692f656d6265642f616164333765656339313134633530376631303964333466663864333861353961646339353033662e737667 "Repobeats analytics image")](https://camo.githubusercontent.com/1810532add46b40130a22675b6357d78c28817ef86638ecea5825483d1be368c/68747470733a2f2f7265706f62656174732e6178696f6d2e636f2f6170692f656d6265642f616164333765656339313134633530376631303964333466663864333861353961646339353033662e737667)