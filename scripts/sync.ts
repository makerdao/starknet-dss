import * as fs from 'fs';
import fetch from 'node-fetch';
import * as path from 'path';

const GITHUB_URL_PREFIX = '// https://github.com/';
const GITHUB_COMMIT_HASH_PREFIX = '// #commit#';
const PROJECT_ROOT = './contracts/starknet';

// Helper function to extract the repository URL and commit hash from the comment
function parseComment(comment: string): { repoUrl: string; commitHash: string; filePath: string } {
  const regex = /https:\/\/github.com\/([^/]*)\/([^/]*)\/blob\/([^#]*)#commit#(.*)/;
  const matches = comment.match(regex);
  if (!matches) throw Error('Comment not formatted correctly');
  const repoUrl = `${matches[1]}/${matches[2]}`; // "makerdao/xdomain-dss"
  const filePath = matches[3].substring(0, matches[3].indexOf('//')); // "src/Cure.sol"
  const commitHash = matches[4]; // "4c8db5f96d8a2f8b1ce771941201da4c037fca02"
  return { repoUrl, commitHash, filePath };
}

// Helper function to check if the commit hash in the comment is the latest commit on the repository
async function isLatestCommit(
  repoUrl: string,
  commitHash: string,
  branch: string,
  file: string
): Promise<boolean> {
  // Use the GitHub API to fetch the latest commit hash for the repository
  const params = new URLSearchParams();
  params.append('path', file);
  params.append('sha', branch);
  params.append('page', '1');
  params.append('per_page', '1');

  const apiUrl = `https://api.github.com/repos/${repoUrl}/commits?` + params;
  // console.log(apiUrl);
  const apiToken = process.env.GITHUB_API_TOKEN;
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json();
  const latestCommitHash = json[0].sha;
  console.log(file, 'value :', latestCommitHash, 'expected :', commitHash);

  // Compare the latest commit hash to the commit hash in the comment
  return latestCommitHash === commitHash;
}

// Function to check all files with the .cairo extension in the project for comments like the example
async function checkForOutdatedCommits() {
  // Traverse all files with the .cairo extension in the project
  const cairoFiles = await fs.promises.readdir(PROJECT_ROOT, { withFileTypes: true });
  for (const file of cairoFiles) {
    if (file.isFile() && file.name.endsWith('.cairo')) {
      // console.info(`Checking file ${file.name}`);
      // Check the file for comments like the example
      const filePath = path.join(PROJECT_ROOT, file.name);
      const fileContents = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContents.split('\n');
      let currentComment = '';
      for (const line of lines) {
        if (line.startsWith(GITHUB_URL_PREFIX) || line.startsWith(GITHUB_COMMIT_HASH_PREFIX)) {
          currentComment += line;
        } else if (currentComment) {
          // We have reached the end of the comment, so parse and check it
          const { repoUrl, commitHash, filePath } = parseComment(currentComment);
          const branch = filePath.substring(0, filePath.indexOf('/'));
          const file = filePath.substring(filePath.indexOf('/'));
          const isLatest = await isLatestCommit(repoUrl, commitHash, branch, file);
          if (!isLatest) {
            console.error(
              'ALERT: The commit referenced in the comment is not the latest commit on the repository!'
            );
            process.exit(1);
          }
          currentComment = ''; // Reset the current comment for the next iteration
        }
      }
    }
  }
}

// Run the check
void checkForOutdatedCommits();
