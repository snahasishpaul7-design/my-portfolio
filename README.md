# Snahasish Paul Tonmoy — Portfolio

My personal portfolio featuring my projects, technical skills, learning interests, and certificates.

## Live website

https://snahasishpaul7-design.github.io/my-portfolio/?refresh=pdf-fix-20261112

## Add a certificate

Use **Add certificate** on the portfolio to add a PDF or image with a title and short description. Added certificates are saved in that browser on that device. To publish a certificate for everyone, add its file under `assets/certificates/` and add its details in `script.js`.

## Add future GitHub projects

The portfolio checks `snahasishpaul7-design` for new public repositories when the page opens. Add a short description in a repository's **About** section so visitors know what it covers.

## Public certificate uploader setup

The public upload endpoint runs in a Cloudflare Worker. Deploy `worker/worker.js`, then add these two secrets in the Worker settings:

- `GITHUB_TOKEN`: a fine-grained GitHub token limited to `snahasishpaul7-design/my-portfolio` with **Contents: read and write** permission.
- `UPLOAD_PASSWORD`: a long, unique password used only in the portfolio's certificate form.

After deploying, put the Worker URL in `window.PORTFOLIO_UPLOAD_ENDPOINT` in `index.html`. The GitHub token stays in Cloudflare and is never sent to the browser. Public uploads are limited to PDF, PNG, JPG, and WebP files up to 8 MB.
