# Educational Attainment Map

An interactive visualization of educational attainment across the United States using Census tract and county-level data from the 2022 American Community Survey (ACS) 5-Year Estimates. This is just a static web page, which fetches data from the Census Bureau's API. My API key is in this repository in plain text, which is fine - a Census API key is more of a public developer ID than a secret key as Census API accounts are not paid (please use your own key if you distribute an application using any of this code).

## Live Demo

[https://educationmap.github.io](https://educationmap.github.io) 

## Usage

To view this map locally, you'll need to run a web server on `localhost` in order to view the base tiles. If you have a python environment, run `python -m http.server 1234` in the root directory of this repository, and visit `http://localhost:1234` in your browser (you can use any port). To host something like this in production, you'd need to set up a Stadia Maps account and whitelist your domain (they have a free tier).

## Technology

Built using:
- deck.gl for 3D visualization
- MapLibre GL JS for base map rendering
- Census Bureau API for demographic data
- Pure JavaScript/HTML/CSS (no framework dependencies)
- Stadia Maps provides basemap tiles

## License

MIT License

Copyright (c) 2024 Hugh Thomas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
