<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - FILE
This action uploads a file including file metadata.

## PARAMS
| Name      | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `VERSION` | String | Format Version              |
| `NAME`    | String | Name of the file            |
| `TYPE`    | String | MIME Type of the file       |
| `TITLE`   | String | Title of the file           |
| `MEMO`    | String | An optional memo to include |

## Formats

### Version `0`
- `VERSION|NAME|TYPE|TITLE|MEMO`

## Examples
```
FILE|0|test.txt|text/plain|Test File|This is a test upload
This example uploads a plain text file named test.txt with the `TITLE` of Test File and a `MEMO`
```

```
FILE|0|xchain.jpg|image/jpeg|XChain Logo|This is the official XChain Logo
This example uploads a JPEG file with the `TITLE` of XChain Logo and a `MEMO`
```

## Rules

## Notes
- Raw file data is uploaded by specifying it as `rawData` to the XChain encoder.
- `TYPE` can be any MIME type supported at https://www.iana.org/assignments/media-types/media-types.xhtml
- `TYPE` examples :
  - `text/plain` = Text File
  - `text/html`  = HTML File
  - `text/csv` = Command Separated Values File
  - `image/jpeg` = JPEG File
  - `image/png` = PNG File
  - `image/gif` = GIF File

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
