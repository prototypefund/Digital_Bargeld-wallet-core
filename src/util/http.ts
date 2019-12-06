/*
 This file is part of TALER
 (C) 2016 GNUnet e.V.

 TALER is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 TALER is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 TALER; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Helpers for doing XMLHttpRequest-s that are based on ES6 promises.
 * Allows for easy mocking for test cases.
 */

/**
 * An HTTP response that is returned by all request methods of this library.
 */
export interface HttpResponse {
  status: number;
  responseJson: object & any;
}

/**
 * The request library is bundled into an interface to make mocking easy.
 */
export interface HttpRequestLibrary {
  get(url: string): Promise<HttpResponse>;

  postJson(url: string, body: any): Promise<HttpResponse>;
}

/**
 * An implementation of the [[HttpRequestLibrary]] using the
 * browser's XMLHttpRequest.
 */
export class BrowserHttpLib implements HttpRequestLibrary {
  private req(
    method: string,
    url: string,
    options?: any,
  ): Promise<HttpResponse> {
    return new Promise<HttpResponse>((resolve, reject) => {
      const myRequest = new XMLHttpRequest();
      myRequest.open(method, url);
      if (options && options.req) {
        myRequest.send(options.req);
      } else {
        myRequest.send();
      }

      myRequest.onerror = e => {
        console.error("http request error");
        reject(Error("could not make XMLHttpRequest"));
      };

      myRequest.addEventListener("readystatechange", e => {
        if (myRequest.readyState === XMLHttpRequest.DONE) {
          if (myRequest.status === 0) {
            reject(Error("HTTP Request failed (status code 0, maybe URI scheme is wrong?)"))
            return;
          }
          if (myRequest.status != 200) {
            reject(
              Error(
                `HTTP Response with unexpected status code ${myRequest.status}: ${myRequest.statusText}`,
              ),
            );
            return;
          }
          let responseJson;
          try {
            responseJson = JSON.parse(myRequest.responseText);
          } catch (e) {
            reject(Error("Invalid JSON from HTTP response"));
            return;
          }
          if (responseJson === null || typeof responseJson !== "object") {
            reject(Error("Invalid JSON from HTTP response"));
            return;
          }
          const resp = {
            responseJson: responseJson,
            status: myRequest.status,
          };
          resolve(resp);
        }
      });
    });
  }

  get(url: string) {
    return this.req("get", url);
  }

  postJson(url: string, body: any) {
    return this.req("post", url, { req: JSON.stringify(body) });
  }

  postForm(url: string, form: any) {
    return this.req("post", url, { req: form });
  }
}