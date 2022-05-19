import type { PolicyBuildStep } from './BuildStep.js';


import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { htmlWebpackPluginTemplateCustomizer as TemplateCustomizer } from 'template-ejs-loader';

import { toUrlSegment } from './util/to-url-segment.js';
import { makeRootRelative } from './util/make-root-relative.js';
import * as paths from './util/paths.js';

import type { File as PolicyFile } from '../schema/File.js';
import type { AlternateFile } from '../schema/AlternateFile.js';

/**
 * Build steps for a particular policy.
 */
export const policyBuildSteps: Record<string, PolicyBuildStep> = {
	/**
	 * Copy the metadata file for a policy to its destination
	 */
	copyMetadata(src, dst) {
		return [new CopyPlugin({
			patterns: [{ from: `${src}/metadata.json`, to: `${dst}/metadata.json` }],
		})];
	},

	/**
	 * Copy all files for a policy to their destinations
	 */
	copyFiles(src, dst, policy) {
		const plugins: CopyPlugin[] = [];

		function copyFile(file: PolicyFile | AlternateFile, versionUrl: string) {
			const fileSrcPathAndName = `${src}/${file.path}`;
			const fileName = file.path.replace(/.*\//, '');

			const fileDstPath = toUrlSegment(versionUrl);
			const fileDstPathAndName = `${dst}/${fileDstPath}/${fileName}`;

			plugins.push(
				new CopyPlugin({
					patterns: [{ from: fileSrcPathAndName, to: fileDstPathAndName }],
				})
			);

			// Update file.path to ensure the build HTML points to the correct place
			const fileDstPathRootRelative = makeRootRelative(fileDstPathAndName);
			file.path = fileDstPathRootRelative;
		}

		for (const version of policy.versions) {
			const versionName = version.name;
			const versionUrl = toUrlSegment(versionName);

			for (const file of version.files) {
				copyFile(file, versionUrl);

				if (file.alternateFiles) {
					for (const altFile of file.alternateFiles) {
						copyFile(altFile, versionUrl);
					}
				}
			}
		}

		return plugins;
	},

	/**
	 * Generate the HTML for a Policy page
	 */
	createPolicyPage(src, dst, policy) {
		const versionPaths: Record<string, string> = {};
		for (const version of policy.versions) {
			versionPaths[version.name] = toUrlSegment(version.name);
		}

		return [new HtmlWebpackPlugin({
			filename: `${dst}/index.html`,
			template: TemplateCustomizer({
				htmlLoaderOption: {
					sources: false,
				},
				templatePath: `${paths.templates}/pages/policy.ejs`,
				templateEjsLoaderOption: {
					data: {
						policy,
						versionPaths,
					},
				},
			}),
			chunks: ['priority', 'main', 'enhancements'],
		})];
	},

	/**
	 * Generate a page for each version of the policy
	 */
	generateVersionPages(src, dst, policy) {
		const plugins: ReturnType<PolicyBuildStep> = [];

		for (const version of policy.versions) {
			const versionName = version.name;
			const versionPathName = toUrlSegment(versionName);
			const versionDst = `${dst}/${versionPathName}`;

			plugins.push(new HtmlWebpackPlugin({
				filename: `${versionDst}/index.html`,
				template: TemplateCustomizer({
					htmlLoaderOption: {
						sources: false,
					},
					templatePath: `${paths.templates}/pages/version.ejs`,
					templateEjsLoaderOption: {
						data: {
							policy,
							version,
						},
					},
				}),
				chunks: ['priority', 'main', 'enhancements'],
			}));
		}

		return plugins;
	},
};
