---

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **Dankest Community License**  
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).  

You may not use, modify, or distribute this material except in compliance with the License.  
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)

---

# XChain Platform Specification - Token Information Standard (TIS)

The Token Information Standard (TIS) defines standardized formats to associate information like images, audio, video, and files with a token.

# JSON Specifications

## v1.0.0
- [Token Information Standard JSON Schema](./json/token-information-standard-v1.0.0-schema.json)
- [Token Information Standard JSON Example](./json/token-information-standard-v1.0.0-example.json)

### JSON Field Definitions

| Field       | Type   | Description
| :---        | :---   | :---
| tick        | String | The TICK of the token
| description | String | A longish description about this token. 2048 characters max.
| website     | String | A link to the website for the token. 100 characters max.
| name        | String | The full name of the token
| html        | String | HTML code providing additional information or functionality
| owner       | Object | Information about the owner of this token
| contacts    | Array  | Information about how to contact the owner of this token
| categories  | Array  | Information on what type of categories this token falls into
| social      | Array  | Social media accounts related to this token
| images      | Array  | One or more images used to represent the token
| audio       | Array  | One or more audio files related to the token
| video       | Array  | One or more video files related to the token
| files       | Array  | One or more files related to the token
| dns         | Array  | One or more DNS records related to the token.


# Supported Token Description Formats

Below are a number of token description formats which should be recognized by XChain block explorers.

## IMAGE Format
<table>
<tr><td><b>Format</b></td><td>https://domain.com/imagename.jpg</td></tr>
<tr><td><b>Note</b></td><td>URL must end in gif, jpg, or png </td></tr>
<tr><td><b>Example</b></td><td>https://xchain.io/img/xchain-color-500.png </td></tr>
</table>

## JSON Format
<table>
<tr><td><b>Format</b></td><td>https://domain.com/info.json</td></tr>
<tr><td><b>Note</b></td><td>URL to a JSON file ending in .json</td></tr>
<tr><td><b>Example</b></td><td>j-dog.net/json/JDOG.json </td></tr>
</table>

## JSON Format with Hash
<table>
<tr><td><b>Format</b></td><td>https://domain.com/info.json;HASH</td></tr>
<tr><td><b>HASH</b></td><td>64-character sha256 hash</td></tr>
<tr><td><b>Note</b></td><td>URL to a JSON file ending in .json</td></tr>
<tr><td><b>Example</b></td><td>j-dog.net/json/JDOG.json;96fc96754c913f60e9d7a0be07d76ffbcdc53338295cbd69595e69cf49616c3b</td></tr>
</table>

## IMGUR Format
<table>
<tr><td><b>Format</b></td><td>imgur/IMAGENAME;TITLE</td></tr>
<tr><td><b>IMAGENAME</b></td><td>Filename of the image on imgur.com</td></tr>
<tr><td><b>TITLE</b></td><td>Title of the image/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://i.imgur.com/yTS3gEv.png the IMAGENAME is yTS3gEv.png</td></tr>
<tr><td><b>Example</b></td><td>imgur/yTS3gEv.png;XChain</td></tr>
</table>

## SOUNDCLOUD Format
<table>
<tr><td><b>Format</b></td><td>soundcloud/CODE;TITLE</td></tr>
<tr><td><b>CODE</b></td><td>Unique code for the audio on soundcloud.com</td></tr>
<tr><td><b>TITLE</b></td><td>the title of the song/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://api.soundcloud.com/tracks/924613324 the CODE is 924613324</td></tr>
<tr><td><b>Example</b></td><td>soundcloud/924613324;Back in Blood</td></tr>
</table>

## YOUTUBE Format
<table>
<tr><td><b>Format</b></td><td>youtube/CODE;TITLE</td></tr>
<tr><td><b>CODE</b></td><td>Unique code for the video on youtube.com</td></tr>
<tr><td><b>TITLE</b></td><td>the title of the video/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://www.youtube.com/watch?v=FenVJ_cyE5M the CODE is FenVJ_cyE5M</td></tr>
<tr><td><b>Example</b></td><td>youtube/FenVJ_cyE5M;Can't Suck Dick!</td></tr>
</table>

## IPFS Format
<table>
<tr><td><b>Format</b></td><td>ipfs:CODE</td></tr>
<tr><td><b>CODE</b></td><td>Unique IPFS CID that points to a JSON file</td></tr>
<tr><td><b>Note</b></td><td>The ipfs format only works with JSON files</td></tr>
<tr><td><b>Example</b></td><td>IPFS:QmdnznjxzrjmLGpwjiDrgfdAu5r7VB4tWWWVtNRtqYqACq</td></tr>
</table>

## Ordinals Inscription Format
<table>
<tr><td><b>Format</b></td><td>ord:CODE</td></tr>
<tr><td><b>CODE</b></td><td>Inscription Reveal Transaction ID (standard 64 character hex string or converted to Base64)</td></tr>
<tr><td><b>Note</b></td><td>The ord format works with inscribed JSON files and inscribed images (png, jpeg and gif only)</td></tr>
<tr><td><b>Example</b></td><td>ORD:1d36aa544a20be86dca452e3abe464d33dd8567392dee8e333f72519e97af679<br/>or<br/>ORD:HTaqVEogvobcpFLjq+Rk0z3YVnOS3ujjM/clGel69nk=</td></tr>
</table>