# Test
test_infrastructure:
	@STAGE=Develop make build_infrastructure # The exact STAGE does not really matter here. Import here is that the lambda code gets build
	cd infrastructure && yarn test
test_lambdas:
	@cd lambdas && yarn test && yarn compile
# test_model:
# 	@cd model && pytest
test: test_infrastructure test_lambdas

# Lint
lint_infrastructure:
	@cd infrastructure && yarn lint
lint_lambdas:
	@cd lambdas && yarn lint && yarn compile
lint_model:
	@flake8 model/
lint: lint_infrastructure lint_lambdas lint_model

# Install
install_infrastructure_dependencies:
	@cd infrastructure && yarn install
install_lambda_dependencies:
	@cd lambdas && yarn install
install_dependencies: install_infrastructure_dependencies install_lambda_dependencies

new_stage:
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
