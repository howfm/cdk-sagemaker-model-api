# Install
install_infrastructure_dependencies:
	@cd infrastructure && yarn install
install_lambda_dependencies:
	@cd lambdas && yarn install
install_dependencies: install_infrastructure_dependencies install_lambda_dependencies

new_stage: install_infrastructure_dependencies
	@cd infrastructure && \
	yarn new-stage

# Build
build_infrastructure: install_dependencies
	@cd infrastructure && \
	rm -rf cdk.out && \
	yarn set-stage && \
	yarn synth && \
	rm .env

# Deploy
deploy: build_infrastructure
	@cd infrastructure && \
	yarn deploy

# Destroy
destroy:
	@cd infrastructure && \
	yarn destroy
