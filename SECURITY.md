# Security policy

## Supported versions

Only the latest release of the Solar-Log integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-solarlog](https://github.com/prohand/gladys-solarlog/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration, of Gladys and the firmware of the Solar-Log;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove passwords, session cookies and addresses first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), the
Solar-Log device and its firmware (report to Solar-Log GmbH), and the third-party
services this integration does not talk to.

## How the integration handles your data

- It only talks to the Solar-Log on your local network (open JSON interface, HTTP).
  Nothing is sent to any cloud service.
- The "user" password is stored as a Gladys **secret** field. It and the session
  cookie of the Solar-Log are never written in the logs.
- The container runs as a non-root user, with a read-only root filesystem.

## Good practices for users

- Give the Solar-Log a fixed address on a trusted network; do not expose its web
  interface to the Internet.
- Protect the "user" access level of the Solar-Log with a password when other
  people share your network.
- Keep Gladys, the integration and the Solar-Log firmware up to date.
